import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

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

// 4.9 - default task order rewards higher-rated members. Ratings arrive in
// Milestone 5; until then this falls back to join order (stable, fair, and
// the exact slot Milestone 5 will slot a rating comparator into).
function computeDefaultOrder<T extends { userId: string; joinedAt: Date }>(members: T[]): T[] {
  return [...members].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
}

async function getCurrentCycle(groupId: string, cycleNumber: number) {
  return prisma.groupCycle.findFirst({ where: { groupId, cycleNumber } });
}

function parseOrder(cycle: { taskOrder: string | null }): string[] {
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

  if (passed) {
    // Release anything not yet completed back to owners' libraries (6.12, 10.12).
    const cycle = await getCurrentCycle(vote.groupId, (await prisma.group.findUniqueOrThrow({ where: { id: vote.groupId } })).currentCycleNumber);
    if (cycle) {
      const order = parseOrder(cycle);
      for (const taskId of order) {
        await releaseTask(taskId);
      }
      await saveOrder(cycle.id, []);
    }
    await prisma.group.update({ where: { id: vote.groupId }, data: { state: "DISBANDED" } });
  }

  return prisma.dissolutionVote.update({
    where: { id: vote.id },
    data: { outcome: passed ? "PASSED" : "FAILED", resolvedAt: new Date() },
  });
}

async function serializeGroupDetail(groupId: string, viewerId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      category: true,
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

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    category: group.category ? { id: group.category.id, name: group.category.name } : null,
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
    pendingApplicationCount,
    members: group.members.map((m) => {
      const task = [...tasksById.values()].find((t) => t.ownerId === m.userId);
      return {
        userId: m.userId,
        firstName: m.user.firstName,
        isLeader: m.isLeader,
        joinedAt: m.joinedAt,
        currentTask: task
          ? { id: task.id, name: task.name, status: task.status, category: task.category.name }
          : null,
      };
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
            }))
        : [],
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

router.get("/groups/browse", async (req, res) => {
  const groups = await prisma.group.findMany({
    where: { state: { in: ["RECRUITING", "READY"] } },
    include: { category: true, leader: true, members: { where: { status: "ACTIVE" } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      category: g.category ? g.category.name : null,
      locationLabel: g.locationLabel,
      sizeMin: g.sizeMin,
      sizeMax: g.sizeMax,
      memberCount: g.members.length,
      leaderName: g.leader.firstName,
      state: g.state,
    }))
  );
});

router.get("/groups/:id", async (req, res) => {
  const group = await serializeGroupDetail(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: "Group not found." });
  res.json(group);
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  categoryId: z.string().optional(),
  locationLabel: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  preferredAgeMin: z.number().int().optional(),
  preferredAgeMax: z.number().int().optional(),
  preferredGender: z.string().optional(),
  durationBand: z.string().optional(),
  sizeMin: z.number().int().min(2).max(50),
  sizeMax: z.number().int().min(2).max(50),
  taskId: z.string().min(1),
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

  const activeGroups = await activeMembershipCount(req.userId!);
  if (activeGroups >= groupLimitFor(owner.subscriptionTier)) {
    return res.status(403).json({ error: `You're already in ${activeGroups} group(s), which is your plan's limit.` });
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        locationLabel: input.locationLabel,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        preferredAgeMin: input.preferredAgeMin,
        preferredAgeMax: input.preferredAgeMax,
        preferredGender: input.preferredGender,
        durationBand: input.durationBand,
        sizeMin: input.sizeMin,
        sizeMax: input.sizeMax,
        leaderId: req.userId!,
        state: "RECRUITING",
        currentCycleNumber: 1,
      },
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
  categoryId: z.string().optional(),
  locationLabel: z.string().optional(),
  preferredAgeMin: z.number().int().optional(),
  preferredAgeMax: z.number().int().optional(),
  preferredGender: z.string().optional(),
  durationBand: z.string().optional(),
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

  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { taskId, message } = parsed.data;

  const task = await prisma.task.findFirst({ where: { id: taskId, ownerId: req.userId } });
  if (!task) return res.status(404).json({ error: "Task not found." });
  if (task.status !== "AVAILABLE") {
    return res.status(400).json({ error: "Only an available task can be submitted." });
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
      applicant: { id: a.applicant.id, firstName: a.applicant.firstName },
      task: { id: a.task.id, name: a.task.name, category: a.task.category.name, estimatedManHours: a.task.estimatedManHours },
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

  const application = await prisma.groupApplication.findFirst({ where: { id: req.params.appId, groupId: group.id, status: "PENDING" } });
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
  } else if (decision === "REJECT") {
    await prisma.$transaction([
      releaseTaskTx(application.taskId),
      prisma.groupApplication.update({ where: { id: application.id }, data: { status: "REJECTED", rejectionReason: reason } }),
    ]);
  } else if (decision === "REQUEST_TASK") {
    await prisma.$transaction([
      releaseTaskTx(application.taskId),
      prisma.groupApplication.update({ where: { id: application.id }, data: { status: "TASK_REQUESTED", rejectionReason: reason } }),
    ]);
  } else if (decision === "SUGGEST_TASK") {
    if (!suggestedTaskId) return res.status(400).json({ error: "Choose which of the applicant's tasks to suggest." });
    const suggested = await prisma.task.findFirst({ where: { id: suggestedTaskId, ownerId: application.applicantId, status: "AVAILABLE" } });
    if (!suggested) return res.status(400).json({ error: "That task isn't available on the applicant's profile." });

    await prisma.$transaction([
      releaseTaskTx(application.taskId),
      prisma.groupApplication.update({ where: { id: application.id }, data: { status: "TASK_SUGGESTED", suggestedTaskId } }),
    ]);
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

  await prisma.$transaction([
    prisma.task.update({ where: { id: task.id }, data: { status: "SUBMITTED", groupId: group.id, cycleId: cycle.id } }),
    prisma.groupApplication.update({ where: { id: application.id }, data: { status: "PENDING", taskId: task.id, suggestedTaskId: null } }),
  ]);

  res.json({ ok: true });
});

// 4.5 - members may leave freely while recruiting.
router.post("/groups/:id/leave", async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Group not found." });
  if (group.leaderId === req.userId) {
    return res.status(400).json({ error: "As the leader, disband the group instead of leaving." });
  }
  if (!["RECRUITING", "READY"].includes(group.state)) {
    return res.status(400).json({ error: "You can only leave while the group is recruiting." });
  }

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.userId! } } });
  if (!member || member.status !== "ACTIVE") return res.status(404).json({ error: "You're not a member of this group." });

  const cycle = await getCurrentCycle(group.id, group.currentCycleNumber);
  const myTask = cycle ? await prisma.task.findFirst({ where: { cycleId: cycle.id, ownerId: req.userId } }) : null;

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: member.id }, data: { status: "LEFT", leftAt: new Date() } });
    if (myTask) await tx.task.update({ where: { id: myTask.id }, data: { status: "AVAILABLE", groupId: null, cycleId: null } });
  });

  if (group.state === "READY" && cycle) {
    const approvedForCycle = await prisma.task.count({ where: { cycleId: cycle.id, status: "APPROVED" } });
    if (approvedForCycle < group.sizeMin) {
      await prisma.group.update({ where: { id: group.id }, data: { state: "RECRUITING" } });
    }
  }

  res.json({ ok: true });
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

  const orderedMembers = computeDefaultOrder(membersWithTask);
  const order = orderedMembers.map((m) => cycleTasks.find((t) => t.ownerId === m.userId)!.id);

  await prisma.$transaction(async (tx) => {
    await tx.groupCycle.update({ where: { id: cycle.id }, data: { startedAt: new Date(), taskOrder: JSON.stringify(order) } });
    await tx.task.update({ where: { id: order[0] }, data: { status: "ACTIVE" } });
    await tx.group.update({ where: { id: group.id }, data: { state: "WORKING" } });
  });

  res.json(await serializeGroupDetail(group.id, req.userId!));
});

async function requireActiveCycle(groupId: string) {
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
    prisma.task.update({ where: { id: second }, data: { status: "ACTIVE" } }),
    prisma.task.update({ where: { id: first }, data: { status: "APPROVED" } }),
  ]);
  await saveOrder(ctx.cycle.id, newOrder);

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
  if (wasActive && newOrder.length > 0) {
    await prisma.task.update({ where: { id: newOrder[0] }, data: { status: "ACTIVE" } });
  }
  await saveOrder(ctx.cycle.id, newOrder);

  if (newOrder.length === 0) {
    await prisma.group.update({ where: { id: req.params.id }, data: { state: "COMPLETED" } });
    await prisma.groupCycle.update({ where: { id: ctx.cycle.id }, data: { completedAt: new Date() } });
  }

  res.json(await serializeGroupDetail(req.params.id, req.userId!));
});

// Mark the active task complete. In this milestone the owner self-reports;
// Milestones 4/5 (scheduling + ratings) will hook a richer trigger in here.
router.post("/groups/:id/tasks/:taskId/complete", async (req, res) => {
  const ctx = await requireActiveCycle(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  const order = parseOrder(ctx.cycle);

  if (order[0] !== req.params.taskId) return res.status(400).json({ error: "Only the active task can be completed." });
  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ownerId: req.userId } });
  if (!task) return res.status(403).json({ error: "This isn't your task." });

  // 3.10 - a completed task becomes permanently archived immediately.
  const newOrder = order.slice(1);
  await prisma.task.update({ where: { id: task.id }, data: { status: "ARCHIVED" } });
  if (newOrder.length > 0) {
    await prisma.task.update({ where: { id: newOrder[0] }, data: { status: "ACTIVE" } });
  }
  await saveOrder(ctx.cycle.id, newOrder);

  if (newOrder.length === 0) {
    await prisma.group.update({ where: { id: req.params.id }, data: { state: "COMPLETED" } });
    await prisma.groupCycle.update({ where: { id: ctx.cycle.id }, data: { completedAt: new Date() } });
  }

  res.json(await serializeGroupDetail(req.params.id, req.userId!));
});

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
  } else {
    await prisma.$transaction(async (tx) => {
      const nextCycleNumber = group.currentCycleNumber + 1;
      await tx.groupCycle.create({ data: { groupId: group.id, cycleNumber: nextCycleNumber } });
      await tx.group.update({ where: { id: group.id }, data: { state: "RECRUITING", currentCycleNumber: nextCycleNumber } });
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
