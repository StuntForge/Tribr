import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { notifyGroupMembers, notifyUser, postSystemMessage } from "../services/notify";
import { computeRatingSummary, revealCycleRatings } from "../services/ratings";
import { haversineMiles } from "../services/geo";
import { JOB_LENGTHS, JOB_LENGTH_RANK } from "./tasks";

const uploadDir = path.join(__dirname, "..", "..", "uploads");

// 10.x - a completed task's photos have served their purpose (leader/members
// could see what the job looked like); deleting them once it's archived
// keeps disk usage bounded as the app accumulates years of history. The
// text record (name/description/etc) stays untouched.
async function deletePhotosForTask(taskId: string) {
  const photos = await prisma.taskPhoto.findMany({ where: { taskId } });
  await Promise.all(
    photos.map(async (p) => {
      const filename = p.url.split("/").pop();
      if (filename) await fs.unlink(path.join(uploadDir, filename)).catch(() => {});
    })
  );
  await prisma.taskPhoto.deleteMany({ where: { taskId } });
}

const router = Router();
router.use(requireAuth);

const FREE_GROUP_LIMIT = 1;
const SUBSCRIBER_GROUP_LIMIT = 6;
const DISSOLUTION_VOTE_HOURS = 48;
const DISSOLUTION_COOLDOWN_DAYS = 7;

function groupLimitFor(tier: string) {
  return tier === "SUBSCRIBER" ? SUBSCRIBER_GROUP_LIMIT : FREE_GROUP_LIMIT;
}

async function activeMembershipCount(userId: string) {
  return prisma.groupMember.count({
    where: { userId, status: "ACTIVE", group: { state: { notIn: ["DISBANDED"] } } },
  });
}

// 4.9 - task order: Pro members always go before Free members, and within
// each tier higher-rated members go first. Members tied on both (including
// everyone unrated) fall back to join order.
async function computeDefaultOrder<T extends { userId: string; joinedAt: Date }>(members: T[]): Promise<T[]> {
  const [ratings, users] = await Promise.all([
    Promise.all(members.map(async (m) => (await computeRatingSummary(m.userId)).overallRating)),
    prisma.user.findMany({ where: { id: { in: members.map((m) => m.userId) } }, select: { id: true, subscriptionTier: true } }),
  ]);
  const isProById = new Map(users.map((u) => [u.id, u.subscriptionTier === "SUBSCRIBER"]));
  return [...members]
    .map((m, i) => ({ member: m, rating: ratings[i], isPro: isProById.get(m.userId) ?? false }))
    .sort((a, b) => {
      if (a.isPro !== b.isPro) return a.isPro ? -1 : 1;
      if (a.rating != null && b.rating != null && a.rating !== b.rating) return b.rating - a.rating;
      if (a.rating != null && b.rating == null) return -1;
      if (a.rating == null && b.rating != null) return 1;
      return a.member.joinedAt.getTime() - b.member.joinedAt.getTime();
    })
    .map((x) => x.member);
}

export async function getCurrentCycle(groupId: string, cycleNumber: number) {
  return prisma.groupCycle.findFirst({ where: { groupId, cycleNumber } });
}

export function parseOrder(cycle: { taskOrder: string | null }): string[] {
  if (!cycle.taskOrder) return [];
  try {
    return JSON.parse(cycle.taskOrder);
  } catch {
    return [];
  }
}

async function saveOrder(cycleId: string, order: string[]) {
  await prisma.groupCycle.update({ where: { id: cycleId }, data: { taskOrder: JSON.stringify(order) } });
}

// 5.x - the same 2-week window the owner sees on their calendar. Kept in
// sync with schedule.ts's PROPOSAL_WINDOW_DAYS.
const PROPOSAL_WINDOW_DAYS = 14;

// If the active task's 2-week scheduling window has passed with no work day
// confirmed, it's automatically forgone and the queue advances to the next
// member's task - resolved lazily on read, the same pattern used for
// dissolution votes above.
export async function forfeitExpiredActiveTask(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.state !== "WORKING") return;

  const cycle = await getCurrentCycle(groupId, group.currentCycleNumber);
  if (!cycle) return;
  const order = parseOrder(cycle);
  if (order.length === 0) return;

  const activeTask = await prisma.task.findUnique({ where: { id: order[0] } });
  if (!activeTask || activeTask.status !== "ACTIVE" || !activeTask.activatedAt) return;

  const deadline = new Date(activeTask.activatedAt.getTime() + PROPOSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (new Date() <= deadline) return;

  const workDay = await prisma.workDay.findUnique({ where: { taskId: activeTask.id } });
  if (workDay) return;

  const newOrder = order.slice(1);
  await prisma.task.update({ where: { id: activeTask.id }, data: { status: "FORGONE" } });
  await postSystemMessage(groupId, `${activeTask.name} was forfeited - no work date was arranged within 2 weeks.`);
  await notifyUser(
    activeTask.ownerId,
    "TASK_FORFEITED",
    "Task forfeited",
    `${activeTask.name} was forfeited because no work date was arranged in time.`,
    { groupId }
  );
  await saveOrder(cycle.id, newOrder);

  if (newOrder.length > 0) {
    const nextTask = await prisma.task.update({
      where: { id: newOrder[0] },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });
    await notifyUser(nextTask.ownerId, "TASK_ACTIVE", "Your task is now active", "It's your turn in this group. Schedule a work date within 2 weeks.", {
      groupId,
      taskId: nextTask.id,
      taskName: nextTask.name,
    });
  } else {
    await prisma.group.update({ where: { id: groupId }, data: { state: "COMPLETED" } });
    await prisma.groupCycle.update({ where: { id: cycle.id }, data: { completedAt: new Date() } });
    await handleCycleComplete(groupId);
  }
}

// Release a task back to the owner's personal library (3.12, 4.6, 6.13).
async function releaseTask(taskId: string, status: "AVAILABLE" = "AVAILABLE") {
  await prisma.task.update({
    where: { id: taskId },
    data: { status, groupId: null, cycleId: null },
  });
}

async function resolveDissolutionVoteIfDue(vote: {
  id: string;
  groupId: string;
  startedAt: Date;
  requestedBy: string;
  endsAt: Date;
  outcome: string | null;
  resolvedAt: Date | null;
}) {
  if (vote.outcome || vote.endsAt > new Date()) return vote;

  const [members, ballots] = await Promise.all([
    prisma.groupMember.findMany({ where: { groupId: vote.groupId, status: "ACTIVE" } }),
    prisma.dissolutionBallot.findMany({ where: { voteId: vote.id } }),
  ]);
  const ballotByUser = new Map(ballots.map((b) => [b.userId, b.choice]));
  // 4.14 - non-voters are automatically counted as Yes.
  let yes = 0;
  let no = 0;
  for (const m of members) {
    const choice = ballotByUser.get(m.userId) ?? "YES";
    if (choice === "YES") yes++;
    else no++;
  }
  const passed = yes > no;
  const group = await prisma.group.findUniqueOrThrow({ where: { id: vote.groupId } });

  if (passed) {
    // Release anything not yet completed back to owners' libraries (6.12, 10.12).
    const cycle = await getCurrentCycle(vote.groupId, group.currentCycleNumber);
    if (cycle) {
      const order = parseOrder(cycle);
      for (const taskId of order) {
        await releaseTask(taskId);
      }
      await saveOrder(cycle.id, []);
      // 6.7/6.12 - ratings already collected in this cycle still count. Mark
      // the cycle itself as ended too, so a late host-rating (submitted
      // after this point) reveals immediately instead of hiding forever.
      await prisma.groupCycle.update({ where: { id: cycle.id }, data: { completedAt: new Date() } });
      await revealCycleRatings(cycle.id);
    }
    await prisma.group.update({ where: { id: vote.groupId }, data: { state: "DISBANDED" } });
  }

  await postSystemMessage(vote.groupId, passed ? "The dissolution vote passed. This group has disbanded." : "The dissolution vote failed. The group continues.");
  await notifyGroupMembers(
    vote.groupId,
    "DISSOLUTION_OUTCOME",
    passed ? "Group dissolved" : "Group continues",
    passed ? `${group.name} was dissolved by member vote.` : `The vote to dissolve ${group.name} did not pass.`
  );

  return prisma.dissolutionVote.update({
    where: { id: vote.id },
    data: { outcome: passed ? "PASSED" : "FAILED", resolvedAt: new Date() },
  });
}

async function serializeGroupDetail(groupId: string, viewerId: string) {
  await forfeitExpiredActiveTask(groupId);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      allowedCategories: { include: { category: true } },
      leader: true,
      members: { where: { status: "ACTIVE" }, include: { user: true }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!group) return null;

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  const order = cycle ? parseOrder(cycle) : [];

  const cycleTasks = cycle
    ? await prisma.task.findMany({ where: { cycleId: cycle.id }, include: { category: true, owner: true } })
    : [];
  const tasksById = new Map(cycleTasks.map((t) => [t.id, t]));

  // Pending dissolution vote, resolved lazily if its window has passed.
  let dissolutionVote = await prisma.dissolutionVote.findFirst({
    where: { groupId: group.id, outcome: null },
    orderBy: { startedAt: "desc" },
  });
  if (dissolutionVote) dissolutionVote = await resolveDissolutionVoteIfDue(dissolutionVote);
  const refreshedGroup = dissolutionVote?.outcome === "PASSED" ? await prisma.group.findUniqueOrThrow({ where: { id: group.id } }) : group;

  const pendingApplicationCount =
    refreshedGroup.leaderId === viewerId
      ? await prisma.groupApplication.count({ where: { groupId: group.id, status: "PENDING" } })
      : undefined;

  const activeMemberCount = group.members.length;

  const memberRatings = await Promise.all(group.members.map(async (m) => (await computeRatingSummary(m.userId)).overallRating));
  const ratedMembers = memberRatings.filter((r): r is number => r != null);
  const averageMemberRating = ratedMembers.length > 0 ? ratedMembers.reduce((a, b) => a + b, 0) / ratedMembers.length : null;

  // Once a cycle has actually started, the job order is frozen (taskOrder
  // was fixed at start-work and only ever changes by defer/forgo/complete/
  // kick, never recomputed wholesale) - the member list should reflect that
  // real, frozen order rather than a live rating/Pro re-sort, so a rating or
  // subscription change mid-cycle can't visually reshuffle who's "next" in a
  // group that's already working. Only RECRUITING/READY groups (nothing
  // frozen yet) show the live preview order.
  const cycleStarted = cycle?.startedAt != null;
  const orderPositionByUserId = new Map<string, number>();
  if (cycleStarted) {
    order.forEach((taskId, idx) => {
      const t = tasksById.get(taskId);
      if (t) orderPositionByUserId.set(t.ownerId, idx);
    });
  }

  // So the queue can tell "active, still needs a date" apart from "active,
  // date's confirmed, just waiting on the day" - the Schedule button and
  // "Active now" label only make sense before a date's actually locked in.
  const confirmedWorkDayTaskIds =
    cycle && refreshedGroup.state === "WORKING"
      ? new Set((await prisma.workDay.findMany({ where: { taskId: { in: order } }, select: { taskId: true } })).map((w) => w.taskId))
      : new Set<string>();

  // 9.5 - visual progress through the current cycle.
  const progress = cycle
    ? {
        completed: cycleTasks.filter((t) => t.status === "ARCHIVED").length,
        forgone: cycleTasks.filter((t) => t.status === "FORGONE").length,
        total: cycleTasks.length,
      }
    : null;

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    categories: group.allowedCategories.map((ac) => ({ id: ac.category.id, name: ac.category.name })),
    verifiedOnly: group.verifiedOnly,
    minRating: group.minRating,
    locationLabel: group.locationLabel,
    preferredAgeMin: group.preferredAgeMin,
    preferredAgeMax: group.preferredAgeMax,
    preferredGender: group.preferredGender,
    durationBand: group.durationBand,
    sizeMin: group.sizeMin,
    sizeMax: group.sizeMax,
    leaderId: group.leaderId,
    leaderName: group.leader.firstName,
    state: refreshedGroup.state,
    currentCycleNumber: group.currentCycleNumber,
    isLeader: group.leaderId === viewerId,
    isMember: group.members.some((m) => m.userId === viewerId),
    memberCount: activeMemberCount,
    averageMemberRating,
    pendingApplicationCount,
    members: group.members
      .map((m, i) => {
        const task = [...tasksById.values()].find((t) => t.ownerId === m.userId);
        return {
          userId: m.userId,
          firstName: m.user.firstName,
          isLeader: m.isLeader,
          isPro: m.user.subscriptionTier === "SUBSCRIBER",
          joinedAt: m.joinedAt,
          rating: memberRatings[i],
          currentTask: task
            ? { id: task.id, name: task.name, status: task.status, category: task.category.name, jobLength: task.jobLength }
            : null,
        };
      })
      .sort((a, b) => {
        if (cycleStarted) {
          const posA = orderPositionByUserId.get(a.userId);
          const posB = orderPositionByUserId.get(b.userId);
          if (posA != null && posB != null) return posA - posB;
          if (posA != null) return -1;
          if (posB != null) return 1;
        }
        if (a.isPro !== b.isPro) return a.isPro ? -1 : 1;
        if (a.rating != null && b.rating != null && a.rating !== b.rating) return b.rating - a.rating;
        if (a.rating != null && b.rating == null) return -1;
        if (a.rating == null && b.rating != null) return 1;
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      }),
    queue:
      cycle && refreshedGroup.state === "WORKING"
        ? order
            .map((taskId) => tasksById.get(taskId))
            .filter((t): t is NonNullable<typeof t> => Boolean(t))
            .map((t, index) => ({
              taskId: t.id,
              taskName: t.name,
              ownerId: t.ownerId,
              ownerName: t.owner.firstName,
              status: t.status,
              isActive: index === 0,
              workDayConfirmed: confirmedWorkDayTaskIds.has(t.id),
            }))
        : [],
    progress,
    dissolutionVote: dissolutionVote
      ? {
          id: dissolutionVote.id,
          startedAt: dissolutionVote.startedAt,
          endsAt: dissolutionVote.endsAt,
          outcome: dissolutionVote.outcome,
        }
      : null,
  };
}

router.get("/groups/mine", async (req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId, status: "ACTIVE" },
    include: { group: true },
  });
  const groups = memberships
    .map((m) => m.group)
    .filter((g) => g.state !== "DISBANDED")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  res.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      state: g.state,
      currentCycleNumber: g.currentCycleNumber,
      isLeader: g.leaderId === req.userId,
    }))
  );
});

// Every group the caller has ever had a membership row in, including ones
// they later left or that disbanded - unlike /groups/mine (current/active
// only), GroupMember rows are never deleted so this is a simple full scan.
router.get("/me/group-history", async (req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId, group: { state: { in: ["COMPLETED", "DISBANDED"] } } },
    include: { group: { include: { members: { where: { status: "ACTIVE" } } } } },
    orderBy: { joinedAt: "desc" },
  });

  res.json(
    memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      state: m.group.state,
      isLeader: m.group.leaderId === req.userId,
      myStatus: m.status,
      memberCount: m.group.members.length,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    }))
  );
});

// 7.3/7.4 - browse recruiting groups. Free members may filter by distance
// only; the other filters are silently ignored for them rather than erroring,
// since the mobile UI simply won't offer those controls to a free account.
router.get("/groups/browse", async (req, res) => {
  const viewer = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const isSubscriber = viewer.subscriptionTier === "SUBSCRIBER";

  const blockedPairs = await prisma.block.findMany({
    where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
  });
  const blockedUserIds = new Set(blockedPairs.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== req.userId));

  const categoryId = isSubscriber && typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const minRating = isSubscriber && typeof req.query.minRating === "string" ? Number(req.query.minRating) : undefined;
  const sizeMin = isSubscriber && typeof req.query.sizeMin === "string" ? Number(req.query.sizeMin) : undefined;
  const sizeMax = isSubscriber && typeof req.query.sizeMax === "string" ? Number(req.query.sizeMax) : undefined;
  const maxDistanceMiles = typeof req.query.maxDistanceMiles === "string" ? Number(req.query.maxDistanceMiles) : undefined;
  const jobLength =
    typeof req.query.jobLength === "string" && (JOB_LENGTHS as readonly string[]).includes(req.query.jobLength)
      ? req.query.jobLength
      : undefined;

  const groups = await prisma.group.findMany({
    where: {
      state: { in: ["RECRUITING", "READY"] },
      leaderId: { notIn: [...blockedUserIds] },
      ...(categoryId ? { allowedCategories: { some: { categoryId } } } : {}),
      ...(sizeMin != null ? { sizeMax: { gte: sizeMin } } : {}),
      ...(sizeMax != null ? { sizeMin: { lte: sizeMax } } : {}),
      // A group's maximum job length (durationBand) is a hard filter here -
      // no point showing a group that couldn't accept a task this long.
      ...(jobLength
        ? { OR: [{ durationBand: null }, { durationBand: { in: JOB_LENGTHS.filter((l) => JOB_LENGTH_RANK[l] >= JOB_LENGTH_RANK[jobLength]) } }] }
        : {}),
      // A group's preferred age range is a hard visibility filter, not just
      // an "ineligible but visible" gate like verifiedOnly/minRating - a
      // group outside your age range shouldn't show up at all. Only applied
      // when we actually know the viewer's age.
      ...(viewer.age != null
        ? {
            AND: [
              { OR: [{ preferredAgeMin: null }, { preferredAgeMin: { lte: viewer.age } }] },
              { OR: [{ preferredAgeMax: null }, { preferredAgeMax: { gte: viewer.age } }] },
            ],
          }
        : {}),
    },
    include: {
      allowedCategories: { include: { category: true } },
      leader: true,
      members: { where: { status: "ACTIVE" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const viewerRatings = await computeRatingSummary(req.userId!);

  const results = await Promise.all(
    groups.map(async (g) => {
      let approxDistanceMiles: number | null = null;
      if (viewer.locationLat != null && viewer.locationLng != null && g.locationLat != null && g.locationLng != null) {
        approxDistanceMiles = Math.round(haversineMiles(viewer.locationLat, viewer.locationLng, g.locationLat, g.locationLng) * 10) / 10;
      }

      const memberRatings = await Promise.all(g.members.map(async (m) => (await computeRatingSummary(m.userId)).overallRating));
      const rated = memberRatings.filter((r): r is number => r != null);
      const averageMemberRating = rated.length > 0 ? rated.reduce((a, b) => a + b, 0) / rated.length : null;

      const meetsRating = g.minRating == null || (viewerRatings.overallRating != null && viewerRatings.overallRating >= g.minRating);
      const meetsVerified = !g.verifiedOnly || viewerRatings.completedCycles > 0;

      const leaderTask = await prisma.task.findFirst({
        where: { groupId: g.id, ownerId: g.leaderId },
        include: { photos: true },
      });

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        categories: g.allowedCategories.map((ac) => ac.category.name),
        locationLabel: g.locationLabel,
        locationLat: g.locationLat,
        locationLng: g.locationLng,
        approxDistanceMiles,
        sizeMin: g.sizeMin,
        sizeMax: g.sizeMax,
        memberCount: g.members.length,
        leaderName: g.leader.firstName,
        leaderIsPro: g.leader.subscriptionTier === "SUBSCRIBER",
        leaderTaskPhotoUrl: leaderTask?.photos[0]?.url ?? null,
        averageMemberRating,
        state: g.state,
        createdAt: g.createdAt,
        verifiedOnly: g.verifiedOnly,
        minRating: g.minRating,
        eligibleToApply: meetsRating && meetsVerified,
      };
    })
  );

  const filtered = results
    .filter((r) => {
      if (maxDistanceMiles != null && (r.approxDistanceMiles == null || r.approxDistanceMiles > maxDistanceMiles)) return false;
      if (minRating != null && (r.averageMemberRating == null || r.averageMemberRating < minRating)) return false;
      return true;
    });

  res.json(filtered);
});

// "What's happening near you" - a random handful of nearby RECRUITING
// groups (not ones already under way), shown as the leader's own task so
// it reads as "here's a real job someone wants help with" rather than an
// abstract group listing. Capped at 50 candidates before shuffling, same
// bound as /groups/browse, so this stays fast regardless of how many
// RECRUITING groups exist worldwide.
router.get("/groups/nearby-recruiting", async (req, res) => {
  const viewer = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

  const blockedPairs = await prisma.block.findMany({
    where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
  });
  const blockedUserIds = new Set(blockedPairs.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== req.userId));

  const groups = await prisma.group.findMany({
    where: { state: "RECRUITING", leaderId: { notIn: [...blockedUserIds] } },
    include: { members: { where: { status: "ACTIVE" }, include: { user: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const withDistance = groups
    .map((g) => {
      let approxDistanceMiles: number | null = null;
      if (viewer.locationLat != null && viewer.locationLng != null && g.locationLat != null && g.locationLng != null) {
        approxDistanceMiles = Math.round(haversineMiles(viewer.locationLat, viewer.locationLng, g.locationLat, g.locationLng) * 10) / 10;
      }
      return { g, approxDistanceMiles };
    })
    .filter((x) => x.approxDistanceMiles == null || x.approxDistanceMiles <= 100);

  for (let i = withDistance.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [withDistance[i], withDistance[j]] = [withDistance[j], withDistance[i]];
  }
  const picked = withDistance.slice(0, 6);

  const results = await Promise.all(
    picked.map(async ({ g, approxDistanceMiles }) => {
      const leaderTask = await prisma.task.findFirst({
        where: { groupId: g.id, ownerId: g.leaderId },
        include: { photos: true },
      });
      return {
        groupId: g.id,
        taskId: leaderTask?.id ?? null,
        taskName: leaderTask?.name ?? g.name,
        taskPhotoUrl: leaderTask?.photos[0]?.url ?? null,
        approxDistanceMiles,
        memberCount: g.members.length,
        sizeMin: g.sizeMin,
        sizeMax: g.sizeMax,
        members: g.members.slice(0, 4).map((m) => ({ firstName: m.user.firstName, photoUrl: m.user.profilePhotoUrl })),
      };
    })
  );

  res.json(results);
});

router.get("/groups/:id", async (req, res) => {
  const group = await serializeGroupDetail(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: "Group not found." });
  res.json(group);
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  categoryIds: z.array(z.string()).min(1, "Choose at least one allowed category."),
  locationLabel: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  preferredAgeMin: z.number().int().optional(),
  preferredAgeMax: z.number().int().optional(),
  preferredGender: z.string().optional(),
  durationBand: z.enum(JOB_LENGTHS).optional(),
  sizeMin: z.number().int().min(3).max(6),
  sizeMax: z.number().int().min(3).max(6),
  taskId: z.string().min(1),
  verifiedOnly: z.boolean().optional(),
  minRating: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

// 4.2 - only subscribers may create groups; creator becomes leader + first member.
router.post("/groups", async (req, res) => {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (owner.subscriptionTier !== "SUBSCRIBER") {
    return res.status(403).json({ error: "Only Subscribers can create groups. Free members can join and apply." });
  }

  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const input = parsed.data;
  if (input.sizeMin > input.sizeMax) {
    return res.status(400).json({ error: "Minimum group size can't be greater than the maximum." });
  }

  const task = await prisma.task.findFirst({ where: { id: input.taskId, ownerId: req.userId } });
  if (!task) return res.status(404).json({ error: "Task not found." });
  if (task.status !== "AVAILABLE") {
    return res.status(400).json({ error: "Only an available task can represent you in a new group." });
  }
  if (!input.categoryIds.includes(task.categoryId)) {
    return res.status(400).json({ error: "Your chosen task's category must be one of the group's allowed categories." });
  }
  if (input.durationBand && task.jobLength && JOB_LENGTH_RANK[task.jobLength] > JOB_LENGTH_RANK[input.durationBand]) {
    return res.status(400).json({ error: "Your chosen task is longer than this group's maximum job length." });
  }

  const activeGroups = await activeMembershipCount(req.userId!);
  if (activeGroups >= groupLimitFor(owner.subscriptionTier)) {
    return res.status(403).json({ error: `You're already in ${activeGroups} group(s), which is your plan's limit.` });
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({
      data: {
        name: input.name,
        description: input.description,
        locationLabel: input.locationLabel,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        preferredAgeMin: input.preferredAgeMin,
        preferredAgeMax: input.preferredAgeMax,
        preferredGender: input.preferredGender,
        durationBand: input.durationBand,
        sizeMin: input.sizeMin,
        sizeMax: input.sizeMax,
        verifiedOnly: input.verifiedOnly ?? false,
        minRating: input.minRating,
        leaderId: req.userId!,
        state: "RECRUITING",
        currentCycleNumber: 1,
      },
    });
    await tx.groupAllowedCategory.createMany({
      data: input.categoryIds.map((categoryId) => ({ groupId: g.id, categoryId })),
    });
    const cycle = await tx.groupCycle.create({ data: { groupId: g.id, cycleNumber: 1 } });
    await tx.groupMember.create({ data: { groupId: g.id, userId: req.userId!, isLeader: true, status: "ACTIVE" } });
    await tx.task.update({
      where: { id: task.id },
      data: { status: "APPROVED", groupId: g.id, cycleId: cycle.id },
    });
    return g;
  });

  res.status(201).json(await serializeGroupDetail(group.id, req.userId!));
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  locationLabel: z.string().optional(),
  preferredAgeMin: z.number().int().optional(),
  preferredAgeMax: z.number().int().optional(),
  preferredGender: z.string().optional(),
  durationBand: z.enum(JOB_LENGTHS).optional(),
  sizeMin: z.number().int().min(2).max(50).optional(),
  sizeMax: z.number().int().min(2).max(50).optional(),
});

// 4.5 - leader may edit group information while recruiting.
router.put("/groups/:id", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can do that." });
  if (!["RECRUITING", "READY"].includes(group.state)) {
    return res.status(400).json({ error: "Group details can only be edited while recruiting." });
  }
  const parsed = updateGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const updated = await prisma.group.update({ where: { id: group.id }, data: parsed.data });
  if (updated.sizeMin > updated.sizeMax) {
    return res.status(400).json({ error: "Minimum group size can't be greater than the maximum." });
  }
  res.json(await serializeGroupDetail(group.id, req.userId!));
});

const applySchema = z.object({ taskId: z.string().min(1), message: z.string().max(500).optional() });

// 4.5/4.6/4.13 - apply to join, or (for an existing member) resubmit a task for a new cycle.
router.post("/groups/:id/apply", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (!["RECRUITING", "READY"].includes(group.state)) {
    return res.status(400).json({ error: "This group isn't recruiting right now." });
  }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: req.userId, blockedId: group.leaderId },
        { blockerId: group.leaderId, blockedId: req.userId },
      ],
    },
  });
  if (blocked) return res.status(403).json({ error: "You can't apply to this group." });

  // Free members must wait 48 hours after a group is created before applying,
  // so brand-new groups aren't immediately swamped ahead of Subscribers.
  const applicant = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (applicant.subscriptionTier !== "SUBSCRIBER") {
    const groupAgeMs = Date.now() - group.createdAt.getTime();
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    if (groupAgeMs < FORTY_EIGHT_HOURS_MS) {
      return res.status(403).json({
        error: "This group is too new for free members to apply to yet. Subscribers can apply right away - try again in a day or two.",
      });
    }
  }

  // 10.x - leader-set eligibility gates: a minimum rating and/or "verified"
  // (has completed at least one cycle before) requirement to apply.
  if (group.verifiedOnly || group.minRating != null) {
    const applicantRatings = await computeRatingSummary(req.userId!);
    if (group.verifiedOnly && applicantRatings.completedCycles === 0) {
      return res.status(403).json({ error: "This group only accepts verified members who've completed at least one cycle." });
    }
    if (group.minRating != null && (applicantRatings.overallRating == null || applicantRatings.overallRating < group.minRating)) {
      return res.status(403).json({
        error: `This group requires a rating of at least ${group.minRating.toFixed(1)}★ to apply.`,
      });
    }
  }

  if (group.preferredAgeMin != null || group.preferredAgeMax != null) {
    if (applicant.age == null || (group.preferredAgeMin != null && applicant.age < group.preferredAgeMin) || (group.preferredAgeMax != null && applicant.age > group.preferredAgeMax)) {
      return res.status(403).json({ error: "You're outside this group's preferred age range." });
    }
  }

  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { taskId, message } = parsed.data;

  const task = await prisma.task.findFirst({ where: { id: taskId, ownerId: req.userId } });
  if (!task) return res.status(404).json({ error: "Task not found." });
  if (task.status !== "AVAILABLE") {
    return res.status(400).json({ error: "Only an available task can be submitted." });
  }
  const allowedCategoryIds = await prisma.groupAllowedCategory.findMany({ where: { groupId: group.id } });
  if (allowedCategoryIds.length > 0 && !allowedCategoryIds.some((ac) => ac.categoryId === task.categoryId)) {
    return res.status(400).json({ error: "This task's category isn't one this group accepts." });
  }
  if (group.durationBand && task.jobLength && JOB_LENGTH_RANK[task.jobLength] > JOB_LENGTH_RANK[group.durationBand]) {
    return res.status(400).json({ error: "This task is longer than this group's maximum job length." });
  }

  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: req.userId! } },
  });
  if (!existingMember) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    const activeGroups = await activeMembershipCount(req.userId!);
    if (activeGroups >= groupLimitFor(owner.subscriptionTier)) {
      return res.status(403).json({ error: `You're already in ${activeGroups} group(s), which is your plan's limit.` });
    }
  }

  // 3.9 - a task recently declined for this group can't be immediately resubmitted.
  const recentlyDeclined = await prisma.groupApplication.findFirst({
    where: { groupId: group.id, taskId, status: { in: ["REJECTED", "TASK_REQUESTED"] } },
  });
  if (recentlyDeclined) {
    return res.status(400).json({ error: "This task was recently declined for this group. Choose a different one." });
  }

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  if (!cycle) return res.status(500).json({ error: "This group has no active cycle." });

  const [application] = await prisma.$transaction([
    prisma.groupApplication.create({
      data: { groupId: group.id, applicantId: req.userId!, taskId, message, status: "PENDING" },
    }),
    prisma.task.update({ where: { id: taskId }, data: { status: "SUBMITTED", groupId: group.id, cycleId: cycle.id } }),
  ]);

  res.status(201).json({ id: application.id, status: application.status });
});

router.get("/groups/:id/applications", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can view applications." });

  const applications = await prisma.groupApplication.findMany({
    where: { groupId: group.id, status: "PENDING" },
    include: { applicant: true, task: { include: { category: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json(
    applications.map((a) => ({
      id: a.id,
      applicant: { id: a.applicant.id, firstName: a.applicant.firstName, isPro: a.applicant.subscriptionTier === "SUBSCRIBER" },
      task: { id: a.task.id, name: a.task.name, category: a.task.category.name, jobLength: a.task.jobLength },
      message: a.message,
      createdAt: a.createdAt,
    }))
  );
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "SUGGEST_TASK", "REQUEST_TASK"]),
  reason: z.string().max(500).optional(),
  suggestedTaskId: z.string().optional(),
});

// 4.6 - the leader's four possible decisions on an application.
router.post("/groups/:id/applications/:appId/decision", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can decide applications." });

  const application = await prisma.groupApplication.findFirst({
    where: { id: req.params.appId, groupId: group.id, status: "PENDING" },
    include: { applicant: true, task: true },
  });
  if (!application) return res.status(404).json({ error: "Application not found or already decided." });

  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { decision, reason, suggestedTaskId } = parsed.data;

  if ((decision === "REJECT" || decision === "REQUEST_TASK") && !reason) {
    return res.status(400).json({ error: "A reason is required." });
  }

  if (decision === "APPROVE") {
    const activeCount = await prisma.groupMember.count({ where: { groupId: group.id, status: "ACTIVE" } });
    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: application.applicantId } },
    });
    if (!existingMember && activeCount >= group.sizeMax) {
      return res.status(400).json({ error: "This group is already at its maximum size." });
    }

    await prisma.$transaction(async (tx) => {
      if (!existingMember) {
        await tx.groupMember.create({ data: { groupId: group.id, userId: application.applicantId, status: "ACTIVE" } });
      }
      await tx.task.update({ where: { id: application.taskId }, data: { status: "APPROVED" } });
      await tx.groupApplication.update({ where: { id: application.id }, data: { status: "APPROVED" } });
    });

    // READY reflects members with an approved task *for this cycle* - on a
    // renewed cycle, raw membership count is stale until people resubmit.
    if (["RECRUITING", "READY"].includes(group.state)) {
      const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
      const approvedForCycle = cycle ? await prisma.task.count({ where: { cycleId: cycle.id, status: "APPROVED" } }) : 0;
      const nextState = approvedForCycle >= group.sizeMin ? "READY" : "RECRUITING";
      if (nextState !== group.state) {
        await prisma.group.update({ where: { id: group.id }, data: { state: nextState } });
      }
    }

    if (!existingMember) {
      await postSystemMessage(group.id, `${application.applicant.firstName} joined with "${application.task.name}".`);
      await notifyGroupMembers(group.id, "NEW_MEMBER_JOINED", "New member joined", `${application.applicant.firstName} joined ${group.name}.`, {
        excludeUserId: application.applicantId,
      });
    }
    await notifyUser(application.applicantId, "APPLICATION_APPROVED", "Application approved", `You're in ${group.name}!`, { groupId: group.id });
  } else if (decision === "REJECT") {
    await prisma.$transaction([
      releaseTaskTx(application.taskId),
      prisma.groupApplication.update({ where: { id: application.id }, data: { status: "REJECTED", rejectionReason: reason } }),
    ]);
    await notifyUser(application.applicantId, "APPLICATION_REJECTED", "Application declined", `Your application to ${group.name} was declined: ${reason}`, {
      groupId: group.id,
    });
  } else if (decision === "REQUEST_TASK") {
    await prisma.$transaction([
      releaseTaskTx(application.taskId),
      prisma.groupApplication.update({ where: { id: application.id }, data: { status: "TASK_REQUESTED", rejectionReason: reason } }),
    ]);
    await notifyUser(
      application.applicantId,
      "APPLICATION_TASK_REQUESTED",
      "Choose a different task",
      `The leader of ${group.name} asked you to submit a different task: ${reason}`,
      { groupId: group.id }
    );
  } else if (decision === "SUGGEST_TASK") {
    if (!suggestedTaskId) return res.status(400).json({ error: "Choose which of the applicant's tasks to suggest." });
    const suggested = await prisma.task.findFirst({ where: { id: suggestedTaskId, ownerId: application.applicantId, status: "AVAILABLE" } });
    if (!suggested) return res.status(400).json({ error: "That task isn't available on the applicant's profile." });

    await prisma.$transaction([
      releaseTaskTx(application.taskId),
      prisma.groupApplication.update({ where: { id: application.id }, data: { status: "TASK_SUGGESTED", suggestedTaskId } }),
    ]);
    await notifyUser(
      application.applicantId,
      "APPLICATION_TASK_SUGGESTED",
      "Task suggested",
      `The leader of ${group.name} suggested a different one of your tasks. Open the application to respond.`,
      { groupId: group.id }
    );
  }

  res.json({ ok: true });
});

function releaseTaskTx(taskId: string) {
  return prisma.task.update({ where: { id: taskId }, data: { status: "AVAILABLE", groupId: null, cycleId: null } });
}

// Applicant's response to a leader's suggested alternative task (4.6).
router.post("/groups/:id/applications/:appId/respond-to-suggestion", async (req, res) => {
  const application = await prisma.groupApplication.findFirst({
    where: { id: req.params.appId, groupId: req.params.id, status: "TASK_SUGGESTED" },
  });
  if (!application) return res.status(404).json({ error: "Suggestion not found." });
  if (application.applicantId !== req.userId) return res.status(403).json({ error: "This isn't your application." });

  const accept = Boolean(req.body.accept);
  if (!accept) {
    await prisma.groupApplication.update({ where: { id: application.id }, data: { status: "REJECTED" } });
    return res.json({ ok: true });
  }

  if (!application.suggestedTaskId) return res.status(400).json({ error: "No suggested task on this application." });
  const group = await prisma.group.findUniqueOrThrow({ where: { id: application.groupId } });
  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  if (!cycle) return res.status(500).json({ error: "This group has no active cycle." });

  const task = await prisma.task.findFirst({ where: { id: application.suggestedTaskId, ownerId: req.userId, status: "AVAILABLE" } });
  if (!task) return res.status(400).json({ error: "That task is no longer available." });
  if (group.durationBand && task.jobLength && JOB_LENGTH_RANK[task.jobLength] > JOB_LENGTH_RANK[group.durationBand]) {
    return res.status(400).json({ error: "This task is longer than this group's maximum job length." });
  }

  await prisma.$transaction([
    prisma.task.update({ where: { id: task.id }, data: { status: "SUBMITTED", groupId: group.id, cycleId: cycle.id } }),
    prisma.groupApplication.update({ where: { id: application.id }, data: { status: "PENDING", taskId: task.id, suggestedTaskId: null } }),
  ]);

  res.json({ ok: true });
});

// ---------- Invitations (7.8) ----------

// 7.10 - members who've left this group before, easy to invite back for a new cycle.
router.get("/groups/:id/previous-members", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can view this." });

  const previous = await prisma.groupMember.findMany({
    where: { groupId: group.id, status: "LEFT" },
    include: {
      user: { include: { tasks: { where: { status: "AVAILABLE" }, include: { category: true } } } },
    },
    orderBy: { leftAt: "desc" },
  });

  res.json(
    previous.map((m) => ({
      userId: m.userId,
      firstName: m.user.firstName,
      activeTasks: m.user.tasks.map((t) => ({ id: t.id, name: t.name, category: t.category.name })),
    }))
  );
});

router.get("/groups/:id/invitations", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can view invitations." });

  const invitations = await prisma.groupInvitation.findMany({
    where: { groupId: group.id, status: "PENDING" },
    include: { invitedUser: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(invitations.map((i) => ({ id: i.id, invitedUser: { id: i.invitedUserId, firstName: i.invitedUser.firstName } })));
});

const inviteSchema = z.object({
  invitedUserId: z.string().min(1),
  suggestedTaskId: z.string().min(1, "Choose which of their tasks you're inviting them to join with."),
});

router.post("/groups/:id/invitations", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can invite members." });
  if (!["RECRUITING", "READY"].includes(group.state)) {
    return res.status(400).json({ error: "This group isn't recruiting right now." });
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { invitedUserId, suggestedTaskId } = parsed.data;

  // 7.11 - blocked users are excluded from invitations.
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: req.userId, blockedId: invitedUserId },
        { blockerId: invitedUserId, blockedId: req.userId },
      ],
    },
  });
  if (blocked) return res.status(403).json({ error: "You can't invite this member." });

  const existingMember = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: invitedUserId } } });
  if (existingMember?.status === "ACTIVE") return res.status(400).json({ error: "They're already a member." });

  const existingInvite = await prisma.groupInvitation.findFirst({ where: { groupId: group.id, invitedUserId, status: "PENDING" } });
  if (existingInvite) return res.status(400).json({ error: "They already have a pending invitation." });

  const task = await prisma.task.findFirst({ where: { id: suggestedTaskId, ownerId: invitedUserId, status: "AVAILABLE" } });
  if (!task) return res.status(400).json({ error: "That task isn't available on their profile." });

  const allowedCategories = await prisma.groupAllowedCategory.findMany({ where: { groupId: group.id } });
  if (allowedCategories.length > 0 && !allowedCategories.some((ac) => ac.categoryId === task.categoryId)) {
    return res.status(400).json({ error: "That task's category isn't one this group accepts." });
  }

  const invitation = await prisma.groupInvitation.create({
    data: { groupId: group.id, invitedUserId, suggestedTaskId },
  });

  await notifyUser(invitedUserId, "GROUP_INVITATION", "Group invitation", `You've been invited to join ${group.name}.`, {
    groupId: group.id,
  });

  res.status(201).json({ id: invitation.id });
});

router.get("/me/invitations", async (req, res) => {
  const viewer = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const invitations = await prisma.groupInvitation.findMany({
    where: { invitedUserId: req.userId, status: "PENDING" },
    include: {
      group: {
        include: { allowedCategories: { include: { category: true } }, leader: true, members: { where: { status: "ACTIVE" } } },
      },
      suggestedTask: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(
    invitations.map((i) => {
      let approxDistanceMiles: number | null = null;
      if (viewer.locationLat != null && viewer.locationLng != null && i.group.locationLat != null && i.group.locationLng != null) {
        approxDistanceMiles = Math.round(haversineMiles(viewer.locationLat, viewer.locationLng, i.group.locationLat, i.group.locationLng) * 10) / 10;
      }
      return {
        id: i.id,
        group: {
          id: i.group.id,
          name: i.group.name,
          categories: i.group.allowedCategories.map((ac) => ac.category.name),
          leaderName: i.group.leader.firstName,
          leaderIsPro: i.group.leader.subscriptionTier === "SUBSCRIBER",
          memberCount: i.group.members.length,
          sizeMin: i.group.sizeMin,
          sizeMax: i.group.sizeMax,
          preferredAgeMin: i.group.preferredAgeMin,
          preferredAgeMax: i.group.preferredAgeMax,
          preferredGender: i.group.preferredGender,
          minRating: i.group.minRating,
          verifiedOnly: i.group.verifiedOnly,
          approxDistanceMiles,
        },
        suggestedTask: i.suggestedTask ? { id: i.suggestedTask.id, name: i.suggestedTask.name } : null,
      };
    })
  );
});

// Public-ish view of who's currently in a group and what they're bringing
// this cycle - used both from a pending invitation and from Browse Groups,
// so a prospective member can see real substance before applying/accepting.
router.get("/groups/:id/current-tasks", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id, status: "ACTIVE" },
    include: { user: true },
    orderBy: { joinedAt: "asc" },
  });

  const tasks = cycle
    ? await prisma.task.findMany({ where: { cycleId: cycle.id }, include: { category: true, photos: true } })
    : [];
  const taskByOwner = new Map(tasks.map((t) => [t.ownerId, t]));

  res.json(
    members.map((m) => {
      const task = taskByOwner.get(m.userId);
      return {
        userId: m.userId,
        firstName: m.user.firstName,
        isLeader: m.isLeader,
        isPro: m.user.subscriptionTier === "SUBSCRIBER",
        task: task
          ? {
              id: task.id,
              name: task.name,
              description: task.description,
              category: task.category.name,
              jobLength: task.jobLength,
              status: task.status,
              photos: task.photos.map((p) => ({ id: p.id, url: p.url })),
            }
          : null,
      };
    })
  );
});

const respondInviteSchema = z.object({ accept: z.boolean(), taskId: z.string().optional() });

// 7.8 - accept (with the suggested task or any other eligible task), or decline.
router.post("/invitations/:id/respond", async (req, res) => {
  const invitation = await prisma.groupInvitation.findFirst({ where: { id: req.params.id, invitedUserId: req.userId, status: "PENDING" } });
  if (!invitation) return res.status(404).json({ error: "Invitation not found." });

  const parsed = respondInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  if (!parsed.data.accept) {
    await prisma.groupInvitation.update({ where: { id: invitation.id }, data: { status: "DECLINED" } });
    return res.json({ ok: true });
  }

  const taskId = parsed.data.taskId ?? invitation.suggestedTaskId;
  if (!taskId) return res.status(400).json({ error: "Choose a task to join with." });

  const group = await prisma.group.findUniqueOrThrow({ where: { id: invitation.groupId } });
  if (!["RECRUITING", "READY"].includes(group.state)) {
    return res.status(400).json({ error: "This group isn't recruiting right now." });
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, ownerId: req.userId, status: "AVAILABLE" } });
  if (!task) return res.status(400).json({ error: "That task isn't available." });
  if (group.durationBand && task.jobLength && JOB_LENGTH_RANK[task.jobLength] > JOB_LENGTH_RANK[group.durationBand]) {
    return res.status(400).json({ error: "This task is longer than this group's maximum job length." });
  }

  const existingMember = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.userId! } } });
  if (!existingMember) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    const activeGroups = await activeMembershipCount(req.userId!);
    if (activeGroups >= groupLimitFor(owner.subscriptionTier)) {
      return res.status(403).json({ error: `You're already in ${activeGroups} group(s), which is your plan's limit.` });
    }
    const activeCount = await prisma.groupMember.count({ where: { groupId: group.id, status: "ACTIVE" } });
    if (activeCount >= group.sizeMax) return res.status(400).json({ error: "This group is already at its maximum size." });
  }

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  if (!cycle) return res.status(500).json({ error: "This group has no active cycle." });

  await prisma.$transaction(async (tx) => {
    if (!existingMember) {
      await tx.groupMember.create({ data: { groupId: group.id, userId: req.userId!, status: "ACTIVE" } });
    }
    await tx.task.update({ where: { id: task.id }, data: { status: "APPROVED", groupId: group.id, cycleId: cycle.id } });
    await tx.groupInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
  });

  if (["RECRUITING", "READY"].includes(group.state)) {
    const approvedForCycle = await prisma.task.count({ where: { cycleId: cycle.id, status: "APPROVED" } });
    const nextState = approvedForCycle >= group.sizeMin ? "READY" : "RECRUITING";
    if (nextState !== group.state) {
      await prisma.group.update({ where: { id: group.id }, data: { state: nextState } });
    }
  }

  const inviteeName = (await prisma.user.findUnique({ where: { id: req.userId } }))?.firstName;
  await postSystemMessage(group.id, `${inviteeName} joined with "${task.name}".`);
  await notifyGroupMembers(group.id, "NEW_MEMBER_JOINED", "New member joined", `${inviteeName} joined ${group.name}.`, {
    excludeUserId: req.userId,
  });

  res.json({ ok: true });
});

// 4.5 - members may leave freely while recruiting. Also allowed once a cycle
// has COMPLETED and the leader hasn't yet started a new one or disbanded -
// members shouldn't be stuck waiting on the leader forever.
router.post("/groups/:id/leave", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId === req.userId) {
    return res.status(400).json({ error: "As the leader, disband the group instead of leaving." });
  }
  if (!["RECRUITING", "READY", "COMPLETED"].includes(group.state)) {
    return res.status(400).json({ error: "You can't leave while the group is actively working through a cycle." });
  }

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.userId! } } });
  if (!member || member.status !== "ACTIVE") return res.status(404).json({ error: "You're not a member of this group." });

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  const myTask = cycle ? await prisma.task.findFirst({ where: { cycleId: cycle.id, ownerId: req.userId } }) : null;
  // Only revert a task that hasn't actually been done yet - a COMPLETED
  // group's task is already ARCHIVED and should stay that way, not get
  // resurrected as if the work never happened.
  const shouldReleaseTask = myTask && myTask.status !== "ARCHIVED";

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: member.id }, data: { status: "LEFT", leftAt: new Date() } });
    if (shouldReleaseTask) await tx.task.update({ where: { id: myTask!.id }, data: { status: "AVAILABLE", groupId: null, cycleId: null } });
  });

  if (group.state === "READY" && cycle) {
    const approvedForCycle = await prisma.task.count({ where: { cycleId: cycle.id, status: "APPROVED" } });
    if (approvedForCycle < group.sizeMin) {
      await prisma.group.update({ where: { id: group.id }, data: { state: "RECRUITING" } });
    }
  }

  const leavingUser = await prisma.user.findUnique({ where: { id: req.userId } });
  await postSystemMessage(group.id, `${leavingUser?.firstName} left the group.`);

  res.json({ ok: true });
});

// Leader removes a member outright - only while nothing has actually
// started yet. Once WORKING, this same outcome has to go through a vote
// (below) instead, since kicking someone mid-cycle affects everyone.
router.post("/groups/:id/members/:userId/remove", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can remove a member." });
  if (req.params.userId === group.leaderId) return res.status(400).json({ error: "You can't remove yourself as leader - disband instead." });
  if (!["RECRUITING", "READY"].includes(group.state)) {
    return res.status(400).json({ error: "Once the group has started, removing someone takes a member vote instead." });
  }

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.params.userId } } });
  if (!member || member.status !== "ACTIVE") return res.status(404).json({ error: "That person isn't a member of this group." });

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  const theirTask = cycle ? await prisma.task.findFirst({ where: { cycleId: cycle.id, ownerId: req.params.userId } }) : null;

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: member.id }, data: { status: "LEFT", leftAt: new Date() } });
    if (theirTask) await tx.task.update({ where: { id: theirTask.id }, data: { status: "AVAILABLE", groupId: null, cycleId: null } });
  });

  if (group.state === "READY" && cycle) {
    const approvedForCycle = await prisma.task.count({ where: { cycleId: cycle.id, status: "APPROVED" } });
    if (approvedForCycle < group.sizeMin) {
      await prisma.group.update({ where: { id: group.id }, data: { state: "RECRUITING" } });
    }
  }

  const removedUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
  await postSystemMessage(group.id, `${removedUser?.firstName} was removed from the group.`);
  await notifyUser(req.params.userId, "REMOVED_FROM_GROUP", "Removed from group", `You were removed from ${group.name}.`, {
    groupId: group.id,
  });

  res.json({ ok: true });
});

// ---------- Vote-kick (once a group is WORKING, removal takes everyone else
// agreeing rather than a leader decision) ----------

async function releaseKickedMember(groupId: string, targetUserId: string) {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  const cycle = await getCurrentCycle(groupId, group.currentCycleNumber);
  const theirTask = cycle ? await prisma.task.findFirst({ where: { cycleId: cycle.id, ownerId: targetUserId } }) : null;

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { status: "LEFT", leftAt: new Date() },
    });
    if (theirTask && theirTask.status !== "ARCHIVED") {
      await tx.task.update({ where: { id: theirTask.id }, data: { status: "AVAILABLE", groupId: null, cycleId: null } });
    }
  });

  // Drop their task out of the active queue too, so the next person's turn
  // is correctly next rather than stuck behind someone who's no longer here.
  if (cycle && theirTask) {
    const order = parseOrder(cycle);
    const wasActive = order[0] === theirTask.id;
    const newOrder = order.filter((taskId) => taskId !== theirTask.id);
    await saveOrder(cycle.id, newOrder);

    if (wasActive && newOrder.length > 0) {
      const nextTask = await prisma.task.update({
        where: { id: newOrder[0] },
        data: { status: "ACTIVE", activatedAt: new Date() },
      });
      await notifyUser(nextTask.ownerId, "TASK_ACTIVE", "Your task is now active", "It's your turn in this group. Schedule a work date within 2 weeks.", {
        groupId,
        taskId: nextTask.id,
        taskName: nextTask.name,
      });
    }
  }
}

const kickVoteSchema = z.object({ targetUserId: z.string().min(1), reason: z.string().min(1).max(300) });

router.post("/groups/:id/kick-votes", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.state !== "WORKING") {
    return res.status(400).json({ error: "Vote-kicks only apply once the group is actively working through a cycle." });
  }

  const requesterMember = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.userId! } } });
  if (!requesterMember || requesterMember.status !== "ACTIVE") return res.status(403).json({ error: "Only group members can start a vote." });

  const parsed = kickVoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { targetUserId, reason } = parsed.data;

  if (targetUserId === req.userId) return res.status(400).json({ error: "You can't start a vote against yourself." });
  if (targetUserId === group.leaderId) return res.status(400).json({ error: "The group leader can't be voted out." });

  const targetMember = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: targetUserId } } });
  if (!targetMember || targetMember.status !== "ACTIVE") return res.status(404).json({ error: "That person isn't a member of this group." });

  const existing = await prisma.kickVote.findFirst({ where: { groupId: group.id, targetUserId, outcome: null } });
  if (existing) return res.status(400).json({ error: "There's already a pending vote against this member." });

  const vote = await prisma.kickVote.create({
    data: {
      groupId: group.id,
      targetUserId,
      initiatorId: req.userId!,
      reason: reason.trim(),
      // Starting a vote is itself an implicit yes.
      ballots: { create: { voterId: req.userId!, choice: "YES" } },
    },
  });

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  const initiator = await prisma.user.findUnique({ where: { id: req.userId } });
  await postSystemMessage(group.id, `${initiator?.firstName} started a vote to remove ${target?.firstName}.`);
  await notifyGroupMembers(group.id, "KICK_VOTE_STARTED", "Vote to remove a member", `${initiator?.firstName} wants to remove ${target?.firstName}: "${reason.trim()}"`, {
    excludeUserId: req.userId,
    extra: { voteId: vote.id },
  });

  res.status(201).json({ id: vote.id });
});

async function serializeKickVote(voteId: string) {
  const vote = await prisma.kickVote.findUnique({
    where: { id: voteId },
    include: { target: true, initiator: true, ballots: { include: { voter: true } } },
  });
  if (!vote) return null;

  const activeMembers = await prisma.groupMember.findMany({ where: { groupId: vote.groupId, status: "ACTIVE" } });
  // Everyone except the target has a say; the initiator's yes is already cast.
  const requiredVoterIds = activeMembers.map((m) => m.userId).filter((id) => id !== vote.targetUserId);

  return {
    id: vote.id,
    groupId: vote.groupId,
    target: { id: vote.targetUserId, firstName: vote.target.firstName },
    initiator: { id: vote.initiatorId, firstName: vote.initiator.firstName },
    reason: vote.reason,
    outcome: vote.outcome,
    createdAt: vote.createdAt,
    requiredVotes: requiredVoterIds.length,
    ballots: vote.ballots.map((b) => ({ voterId: b.voterId, firstName: b.voter.firstName, choice: b.choice })),
  };
}

router.get("/groups/:id/kick-votes", async (req, res) => {
  const votes = await prisma.kickVote.findMany({ where: { groupId: req.params.id, outcome: null }, orderBy: { createdAt: "desc" } });
  res.json((await Promise.all(votes.map((v) => serializeKickVote(v.id)))).filter(Boolean));
});

router.get("/kick-votes/:voteId", async (req, res) => {
  const vote = await serializeKickVote(req.params.voteId);
  if (!vote) return res.status(404).json({ error: "Vote not found." });
  res.json(vote);
});

const kickBallotSchema = z.object({ choice: z.enum(["YES", "NO"]) });

router.post("/kick-votes/:voteId/ballot", async (req, res) => {
  const vote = await prisma.kickVote.findUnique({ where: { id: req.params.voteId } });
  if (!vote || vote.outcome != null) return res.status(404).json({ error: "This vote is no longer open." });
  if (req.userId === vote.targetUserId) return res.status(403).json({ error: "You can't vote on your own removal." });

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: vote.groupId, userId: req.userId! } } });
  if (!member || member.status !== "ACTIVE") return res.status(403).json({ error: "Only group members can vote." });

  const parsed = kickBallotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existingBallot = await prisma.kickBallot.findUnique({ where: { voteId_voterId: { voteId: vote.id, voterId: req.userId! } } });
  if (existingBallot) return res.status(400).json({ error: "You've already voted." });

  await prisma.kickBallot.create({ data: { voteId: vote.id, voterId: req.userId!, choice: parsed.data.choice } });

  const group = await prisma.group.findUniqueOrThrow({ where: { id: vote.groupId } });
  const target = await prisma.user.findUnique({ where: { id: vote.targetUserId } });

  if (parsed.data.choice === "NO") {
    await prisma.kickVote.update({ where: { id: vote.id }, data: { outcome: "FAILED", resolvedAt: new Date() } });
    await postSystemMessage(vote.groupId, `The vote to remove ${target?.firstName} did not pass.`);
    await notifyGroupMembers(vote.groupId, "KICK_VOTE_OUTCOME", "Vote failed", `The vote to remove ${target?.firstName} did not pass.`, {
      extra: { voteId: vote.id },
    });
    return res.json({ ok: true, outcome: "FAILED" });
  }

  const activeMembers = await prisma.groupMember.findMany({ where: { groupId: vote.groupId, status: "ACTIVE" } });
  const requiredVoterIds = activeMembers.map((m) => m.userId).filter((id) => id !== vote.targetUserId);
  const yesBallots = await prisma.kickBallot.findMany({ where: { voteId: vote.id, choice: "YES" } });
  const allAgreed = requiredVoterIds.every((id) => yesBallots.some((b) => b.voterId === id));

  if (allAgreed) {
    await prisma.kickVote.update({ where: { id: vote.id }, data: { outcome: "REMOVED", resolvedAt: new Date() } });
    await releaseKickedMember(vote.groupId, vote.targetUserId);
    await postSystemMessage(vote.groupId, `${target?.firstName} was removed from the group by member vote.`);
    await notifyGroupMembers(vote.groupId, "KICK_VOTE_OUTCOME", "Member removed", `${target?.firstName} was removed from ${group.name} by member vote.`, {
      extra: { voteId: vote.id },
    });
    await notifyUser(vote.targetUserId, "REMOVED_FROM_GROUP", "Removed from group", `You were removed from ${group.name} by member vote.`, {
      groupId: group.id,
    });
    return res.json({ ok: true, outcome: "REMOVED" });
  }

  res.json({ ok: true, outcome: null });
});

// 4.5/4.12 - leader disbands (during recruiting, or after a cycle completes).
router.post("/groups/:id/disband", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can disband the group." });
  if (!["RECRUITING", "READY", "COMPLETED"].includes(group.state)) {
    return res.status(400).json({ error: "This group can't be disbanded while work is in progress. Request dissolution instead." });
  }

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  if (cycle) {
    const tasksInCycle = await prisma.task.findMany({ where: { cycleId: cycle.id, status: { notIn: ["COMPLETED", "ARCHIVED"] } } });
    await Promise.all(tasksInCycle.map((t) => releaseTask(t.id)));
  }
  const pendingApps = await prisma.groupApplication.findMany({ where: { groupId: group.id, status: "PENDING" } });
  await Promise.all(pendingApps.map((a) => releaseTask(a.taskId)));
  await prisma.groupApplication.updateMany({ where: { groupId: group.id, status: "PENDING" }, data: { status: "REJECTED", rejectionReason: "Group disbanded." } });

  await prisma.group.update({ where: { id: group.id }, data: { state: "DISBANDED" } });
  await notifyGroupMembers(group.id, "GROUP_DISBANDED", "Group disbanded", `${group.name} has been disbanded by the leader.`, {
    excludeUserId: req.userId,
  });
  res.json({ ok: true });
});

// 4.7/4.8 - lock the group and begin the cycle.
router.post("/groups/:id/start-work", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can start work." });
  if (!["RECRUITING", "READY"].includes(group.state)) {
    return res.status(400).json({ error: "This group has already started work." });
  }

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  if (!cycle) return res.status(500).json({ error: "This group has no active cycle." });

  const cycleTasks = await prisma.task.findMany({ where: { cycleId: cycle.id, status: "APPROVED" }, orderBy: { createdAt: "asc" } });
  const members = await prisma.groupMember.findMany({ where: { groupId: group.id, status: "ACTIVE" } });
  const membersWithTask = members.filter((m) => cycleTasks.some((t) => t.ownerId === m.userId));

  if (membersWithTask.length < group.sizeMin) {
    return res.status(400).json({ error: `You need at least ${group.sizeMin} members with an approved task to start.` });
  }

  const orderedMembers = await computeDefaultOrder(membersWithTask);
  const order = orderedMembers.map((m) => cycleTasks.find((t) => t.ownerId === m.userId)!.id);

  await prisma.$transaction(async (tx) => {
    await tx.groupCycle.update({ where: { id: cycle.id }, data: { startedAt: new Date(), taskOrder: JSON.stringify(order) } });
    await tx.task.update({ where: { id: order[0] }, data: { status: "ACTIVE", activatedAt: new Date() } });
    await tx.group.update({ where: { id: group.id }, data: { state: "WORKING" } });
  });

  const firstTask = cycleTasks.find((t) => t.id === order[0])!;
  await postSystemMessage(group.id, "Start Work - the cycle has begun!");
  await notifyGroupMembers(group.id, "START_WORK", "Work has started", `${group.name} has started this cycle.`);
  await notifyUser(firstTask.ownerId, "TASK_ACTIVE", "Your task is now active", `It's your turn in ${group.name}. Schedule a work date within 2 weeks.`, {
    groupId: group.id,
    taskId: firstTask.id,
    taskName: firstTask.name,
  });

  res.json(await serializeGroupDetail(group.id, req.userId!));
});

export async function requireActiveCycle(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.state !== "WORKING") return { error: "This group isn't currently working through a cycle." as const };
  const cycle = await getCurrentCycle(groupId, group.currentCycleNumber);
  if (!cycle) return { error: "This group has no active cycle." as const };
  return { group, cycle };
}

// 4.10 - defer the active task behind the next one in the queue.
router.post("/groups/:id/tasks/:taskId/defer", async (req, res) => {
  const ctx = await requireActiveCycle(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  const order = parseOrder(ctx.cycle);

  if (order[0] !== req.params.taskId) return res.status(400).json({ error: "Only the active task can be deferred." });
  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ownerId: req.userId } });
  if (!task) return res.status(403).json({ error: "This isn't your task." });
  if (order.length < 2) return res.status(400).json({ error: "There's no other task queued to defer behind." });

  const [first, second, ...rest] = order;
  const newOrder = [second, first, ...rest];
  await prisma.$transaction([
    prisma.task.update({ where: { id: second }, data: { status: "ACTIVE", activatedAt: new Date() } }),
    prisma.task.update({ where: { id: first }, data: { status: "APPROVED" } }),
  ]);
  await saveOrder(ctx.cycle.id, newOrder);

  const nextTask = await prisma.task.findUniqueOrThrow({ where: { id: second } });
  await postSystemMessage(req.params.id, `${task.name} was deferred. It's now ${nextTask.name}'s turn.`);
  await notifyUser(nextTask.ownerId, "TASK_ACTIVE", "Your task is now active", "It's your turn in this group. Schedule a work date within 2 weeks.", {
    groupId: req.params.id,
    taskId: nextTask.id,
    taskName: nextTask.name,
  });

  res.json(await serializeGroupDetail(req.params.id, req.userId!));
});

// 4.11 - voluntarily remove your own task from the current cycle.
router.post("/groups/:id/tasks/:taskId/forgo", async (req, res) => {
  const ctx = await requireActiveCycle(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });

  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ownerId: req.userId, cycleId: ctx.cycle.id } });
  if (!task) return res.status(403).json({ error: "This isn't your task in this cycle." });
  if (["COMPLETED", "ARCHIVED", "FORGONE"].includes(task.status)) {
    return res.status(400).json({ error: "This task has already been settled for this cycle." });
  }

  const order = parseOrder(ctx.cycle);
  const wasActive = order[0] === task.id;
  const newOrder = order.filter((id) => id !== task.id);

  await prisma.task.update({ where: { id: task.id }, data: { status: "FORGONE" } });
  await postSystemMessage(req.params.id, `${task.name} was forgone for this cycle.`);
  if (wasActive && newOrder.length > 0) {
    const nextTask = await prisma.task.findUniqueOrThrow({ where: { id: newOrder[0] } });
    await prisma.task.update({ where: { id: nextTask.id }, data: { status: "ACTIVE", activatedAt: new Date() } });
    await notifyUser(nextTask.ownerId, "TASK_ACTIVE", "Your task is now active", "It's your turn in this group. Schedule a work date within 2 weeks.", {
      groupId: req.params.id,
      taskId: nextTask.id,
      taskName: nextTask.name,
    });
  }
  await saveOrder(ctx.cycle.id, newOrder);

  if (newOrder.length === 0) {
    await prisma.group.update({ where: { id: req.params.id }, data: { state: "COMPLETED" } });
    await prisma.groupCycle.update({ where: { id: ctx.cycle.id }, data: { completedAt: new Date() } });
    await handleCycleComplete(req.params.id);
  }

  res.json(await serializeGroupDetail(req.params.id, req.userId!));
});

const scoreSchema = z.number().int().min(1).max(5);

const completeTaskSchema = z.object({
  attendance: z.array(
    z.object({
      userId: z.string().min(1),
      status: z.enum(["ATTENDED", "NO_SHOW", "VALID_REASON"]),
      performance: scoreSchema.optional(),
      attitude: scoreSchema.optional(),
      reliability: scoreSchema.optional(),
    })
  ),
});

// 6.3/6.6 - completing a task requires the owner to record attendance and
// rate every member who confirmed availability. 3.10 - it then archives.
router.post("/groups/:id/tasks/:taskId/complete", async (req, res) => {
  const ctx = await requireActiveCycle(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  const order = parseOrder(ctx.cycle);

  if (order[0] !== req.params.taskId) return res.status(400).json({ error: "Only the active task can be completed." });
  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ownerId: req.userId } });
  if (!task) return res.status(403).json({ error: "This isn't your task." });

  const workDay = await prisma.workDay.findUnique({ where: { taskId: task.id } });
  if (!workDay) return res.status(400).json({ error: "Confirm a work date before marking this task complete." });

  const parsed = completeTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  // 6.5 - only members who marked themselves available are in scope at all.
  const availableResponses = await prisma.availabilityResponse.findMany({
    where: { available: true, dateOption: { proposal: { taskId: task.id }, date: workDay.confirmedDate } },
  });
  const expectedUserIds = new Set(availableResponses.map((r) => r.userId).filter((id) => id !== task.ownerId));
  const providedUserIds = new Set(parsed.data.attendance.map((a) => a.userId));
  if (expectedUserIds.size !== providedUserIds.size || [...expectedUserIds].some((id) => !providedUserIds.has(id))) {
    return res.status(400).json({ error: "Attendance must cover exactly the members who confirmed availability." });
  }
  for (const entry of parsed.data.attendance) {
    if (entry.status === "ATTENDED" && (entry.performance == null || entry.attitude == null || entry.reliability == null)) {
      return res.status(400).json({ error: "Rate performance, attitude and reliability for every attendee." });
    }
  }

  await Promise.all(
    parsed.data.attendance.map((entry) => {
      const base = { taskId: task.id, raterId: req.userId!, rateeId: entry.userId, type: "WORKER" as const, visible: false };
      if (entry.status === "ATTENDED") {
        return prisma.ratingEvent.create({
          data: { ...base, scoreA: entry.performance!, scoreB: entry.attitude!, scoreC: entry.reliability! },
        });
      }
      const noShow = entry.status === "NO_SHOW";
      // 6.6 - hidden 1/5 for a no-show, hidden neutral 3/5 for a valid reason.
      const score = noShow ? 1 : 3;
      return prisma.ratingEvent.create({
        data: { ...base, scoreA: score, scoreB: score, scoreC: score, isNoShow: noShow, isValidAbsence: !noShow },
      });
    })
  );

  const attendedUserIds = parsed.data.attendance.filter((a) => a.status === "ATTENDED").map((a) => a.userId);

  // 3.10 - a completed task becomes permanently archived immediately.
  const newOrder = order.slice(1);
  await prisma.task.update({ where: { id: task.id }, data: { status: "ARCHIVED" } });
  await deletePhotosForTask(task.id);
  await postSystemMessage(req.params.id, `${task.name} was completed! 🎉`);
  await notifyGroupMembers(req.params.id, "TASK_COMPLETED", "Task completed", `${task.name} was marked complete.`);
  for (const userId of attendedUserIds) {
    await notifyUser(userId, "RATE_HOST_PENDING", "Rate the host", `How was ${task.name}? Rate the host while it's fresh.`, {
      groupId: req.params.id,
      taskId: task.id,
    });
  }
  if (newOrder.length > 0) {
    const nextTask = await prisma.task.findUniqueOrThrow({ where: { id: newOrder[0] } });
    await prisma.task.update({ where: { id: nextTask.id }, data: { status: "ACTIVE", activatedAt: new Date() } });
    await notifyUser(nextTask.ownerId, "TASK_ACTIVE", "Your task is now active", "It's your turn in this group. Schedule a work date within 2 weeks.", {
      groupId: req.params.id,
      taskId: nextTask.id,
      taskName: nextTask.name,
    });
  }
  await saveOrder(ctx.cycle.id, newOrder);

  if (newOrder.length === 0) {
    await prisma.group.update({ where: { id: req.params.id }, data: { state: "COMPLETED" } });
    await prisma.groupCycle.update({ where: { id: ctx.cycle.id }, data: { completedAt: new Date() } });
    await handleCycleComplete(req.params.id);
  }

  res.json(await serializeGroupDetail(req.params.id, req.userId!));
});

const rateHostSchema = z.object({ hosting: scoreSchema, accuracy: scoreSchema, attitude: scoreSchema });

// 6.4 - every attending member rates the task owner once the task is done.
router.post("/groups/:id/tasks/:taskId/rate-host", async (req, res) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, groupId: req.params.id, status: "ARCHIVED" } });
  if (!task) return res.status(404).json({ error: "Completed task not found." });
  if (task.ownerId === req.userId) return res.status(400).json({ error: "You can't rate your own task." });

  const attended = await prisma.ratingEvent.findFirst({
    where: { taskId: task.id, rateeId: req.userId, type: "WORKER", isNoShow: false, isValidAbsence: false },
  });
  if (!attended) return res.status(403).json({ error: "Only attendees can rate the host." });

  const already = await prisma.ratingEvent.findFirst({ where: { taskId: task.id, raterId: req.userId, type: "HOST" } });
  if (already) return res.status(400).json({ error: "You've already rated this host." });

  const parsed = rateHostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  // The cycle-complete reveal trigger only fires once. If this rating arrives
  // after that already happened (rating the host is an async, whenever-you-
  // get-to-it action), reveal it immediately instead of hiding it forever.
  const alreadyEnded = task.cycleId ? (await prisma.groupCycle.findUnique({ where: { id: task.cycleId } }))?.completedAt != null : false;

  await prisma.ratingEvent.create({
    data: {
      taskId: task.id,
      raterId: req.userId!,
      rateeId: task.ownerId,
      type: "HOST",
      scoreA: parsed.data.hosting,
      scoreB: parsed.data.accuracy,
      scoreC: parsed.data.attitude,
      visible: alreadyEnded,
    },
  });

  // 6.7 - the host already rated every attendee at completion time; once
  // every expected attendee has rated the host back too, this task's
  // ratings are instantly complete - reveal them now instead of waiting for
  // the whole cycle to end.
  const workerRatings = await prisma.ratingEvent.findMany({
    where: { taskId: task.id, type: "WORKER", isNoShow: false, isValidAbsence: false },
  });
  const hostRatings = await prisma.ratingEvent.findMany({ where: { taskId: task.id, type: "HOST" } });
  const allRated = workerRatings.length > 0 && workerRatings.every((w) => hostRatings.some((h) => h.raterId === w.rateeId));
  if (allRated) {
    await prisma.ratingEvent.updateMany({ where: { taskId: task.id }, data: { visible: true } });
  }

  res.json({ ok: true });
});

async function handleCycleComplete(groupId: string) {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  const cycle = await getCurrentCycle(groupId, group.currentCycleNumber);
  // 6.7 - ratings collected during this cycle become part of public reputation now.
  if (cycle) await revealCycleRatings(cycle.id);
  await postSystemMessage(groupId, "Every task in this cycle is complete!");
  await notifyUser(group.leaderId, "CYCLE_COMPLETE", "Cycle complete", "Choose whether to start a new cycle or end the group.", { groupId: group.id });
}

const completeCycleSchema = z.object({ action: z.enum(["DISBAND", "START_NEW_CYCLE"]) });

// 4.12/4.13 - once every active task is settled, the leader chooses what's next.
router.post("/groups/:id/complete-cycle", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the group leader can do that." });
  if (group.state !== "COMPLETED") return res.status(400).json({ error: "This cycle isn't finished yet." });

  const parsed = completeCycleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  const forgoneTasks = cycle ? await prisma.task.findMany({ where: { cycleId: cycle.id, status: "FORGONE" } }) : [];
  await Promise.all(forgoneTasks.map((t) => releaseTask(t.id)));

  if (parsed.data.action === "DISBAND") {
    await prisma.group.update({ where: { id: group.id }, data: { state: "DISBANDED" } });
    await notifyGroupMembers(group.id, "GROUP_DISBANDED", "Group disbanded", `${group.name} has ended.`, { excludeUserId: req.userId });
  } else {
    await prisma.$transaction(async (tx) => {
      const nextCycleNumber = group.currentCycleNumber + 1;
      await tx.groupCycle.create({ data: { groupId: group.id, cycleNumber: nextCycleNumber } });
      await tx.group.update({ where: { id: group.id }, data: { state: "RECRUITING", currentCycleNumber: nextCycleNumber } });
    });
    await postSystemMessage(group.id, "Starting a new cycle — submit a task to continue.");
    await notifyGroupMembers(group.id, "START_NEW_CYCLE", "New cycle starting", `${group.name} is starting a new cycle. Submit a task to continue.`, {
      excludeUserId: req.userId,
    });
  }

  res.json(await serializeGroupDetail(group.id, req.userId!));
});

// ---------- Dissolution (4.14) ----------

router.post("/groups/:id/dissolution/request", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.state !== "WORKING") return res.status(400).json({ error: "Dissolution can only be requested once work has begun." });

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.userId! } } });
  if (!member || member.status !== "ACTIVE") return res.status(403).json({ error: "Only group members can request dissolution." });

  const openVote = await prisma.dissolutionVote.findFirst({ where: { groupId: group.id, outcome: null } });
  if (openVote) return res.status(400).json({ error: "A dissolution vote is already open." });

  const lastVote = await prisma.dissolutionVote.findFirst({ where: { groupId: group.id }, orderBy: { startedAt: "desc" } });
  if (lastVote?.outcome === "FAILED" && lastVote.resolvedAt) {
    const cooldownEnds = new Date(lastVote.resolvedAt.getTime() + DISSOLUTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    if (cooldownEnds > new Date()) {
      return res.status(400).json({ error: `Another request can't be started until ${cooldownEnds.toDateString()}.` });
    }
  }

  const vote = await prisma.dissolutionVote.create({
    data: {
      groupId: group.id,
      requestedBy: req.userId!,
      endsAt: new Date(Date.now() + DISSOLUTION_VOTE_HOURS * 60 * 60 * 1000),
    },
  });
  await prisma.dissolutionBallot.create({ data: { voteId: vote.id, userId: req.userId!, choice: "YES" } });

  const requester = await prisma.user.findUnique({ where: { id: req.userId } });
  await postSystemMessage(group.id, `${requester?.firstName} requested to dissolve the group. Voting closes in 48 hours.`);
  await notifyGroupMembers(
    group.id,
    "DISSOLUTION_VOTE_STARTED",
    "Dissolution vote started",
    `A member of ${group.name} requested to dissolve the group. Cast your vote.`,
    { excludeUserId: req.userId }
  );

  res.status(201).json({ id: vote.id, endsAt: vote.endsAt });
});

const ballotSchema = z.object({ choice: z.enum(["YES", "NO"]) });

router.post("/groups/:id/dissolution/:voteId/ballot", async (req, res) => {
  const vote = await prisma.dissolutionVote.findFirst({ where: { id: req.params.voteId, groupId: req.params.id, outcome: null } });
  if (!vote) return res.status(404).json({ error: "Vote not found or already resolved." });
  if (vote.endsAt <= new Date()) {
    await resolveDissolutionVoteIfDue(vote);
    return res.status(400).json({ error: "Voting has closed." });
  }

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: req.params.id, userId: req.userId! } } });
  if (!member || member.status !== "ACTIVE") return res.status(403).json({ error: "Only group members can vote." });

  const parsed = ballotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  await prisma.dissolutionBallot.upsert({
    where: { voteId_userId: { voteId: vote.id, userId: req.userId! } },
    create: { voteId: vote.id, userId: req.userId!, choice: parsed.data.choice },
    update: { choice: parsed.data.choice },
  });

  res.json({ ok: true });
});

export default router;
