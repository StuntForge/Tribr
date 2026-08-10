import { prisma } from "../db";

// One-off demo-data generator, triggered from the admin portal. Creates a
// fresh batch of 50 users and 20 groups spanning every group lifecycle
// state, so the app always has a realistic, full-spectrum feed to demo -
// running it again just adds another batch on top (safe, additive).

const FIRST_NAMES = [
  "Noah", "Ava", "Mason", "Mia", "Ethan", "Lily", "Oscar", "Ivy",
  "George", "Nancy", "Archie", "Rosie", "Freddie", "Evie", "Arthur", "Hannah",
  "Jacob", "Layla", "Charlie", "Willow", "Henry", "Daisy", "Theo", "Maya",
  "Alfie", "Phoebe", "Toby", "Elsie", "Reuben", "Nora", "Stanley", "Bea",
  "Felix", "Martha", "Wilfred", "Agnes", "Percy", "Edith", "Sonny", "Betty",
  "Jude", "Clara", "Rory", "Iris", "Elliot", "June", "Frankie", "Wren",
  "Caleb", "Matilda",
];

// Same Frithville centre point used across every seed script, so this batch
// scatters realistically around the real SUBSCRIBER test account's location.
const CENTER = { lat: 53.1699, lng: -0.1699 };

function randomOffset(maxMiles: number) {
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * maxMiles;
  const dLat = (distance * Math.cos(angle)) / 69;
  const dLng = (distance * Math.sin(angle)) / (69 * Math.cos((CENTER.lat * Math.PI) / 180));
  return { lat: CENTER.lat + dLat, lng: CENTER.lng + dLng };
}

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  return pick(arr, arr.length);
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Lorem Picsum - free placeholder image service, exactly for cases like this
// (fake seed data that needs a real-looking photo URL, no licensing concerns).
function stockPhotoUrl(seed: string) {
  return `https://picsum.photos/seed/${seed}/800/600`;
}

const GROUP_NAMES = [
  "Boston Fenland Fixers",
  "Louth Lawn & Border Crew",
  "Sleaford Shed Builders",
  "Horncastle Handy Helpers",
  "Woodhall Spa Weekend Crew",
  "Spalding Bulb Belt Gardeners",
  "Coningsby Carpentry Collective",
  "Skegness Storm-Damage Squad",
  "Alford Allotment Alliance",
  "Wragby Wall & Fence Crew",
  "Metheringham Mates",
  "Ruskington Roofers Ring",
  "Heckington Handy Gang",
  "Donington Decorating Duo",
  "Holbeach Home Helpers",
  "Long Sutton Landscaping Crew",
  "Bourne Brick & Block Squad",
  "Grimsby Garden Grafters",
  "Cleethorpes Coastal Crew",
  "Mablethorpe Maintenance Mob",
];

type GroupPlan = { state: string; targetMembers: number };

// COMPLETED groups are listed first so they get first pick of member
// capacity, maximising how many seeded users end up with a real completed
// rating history for a properly mixed-state feed.
const PLANS: GroupPlan[] = [
  { state: "COMPLETED", targetMembers: 5 },
  { state: "COMPLETED", targetMembers: 4 },
  { state: "COMPLETED", targetMembers: 4 },
  { state: "COMPLETED", targetMembers: 3 },
  { state: "WORKING", targetMembers: 4 },
  { state: "WORKING", targetMembers: 3 },
  { state: "WORKING", targetMembers: 3 },
  { state: "WORKING", targetMembers: 2 },
  { state: "READY", targetMembers: 3 },
  { state: "READY", targetMembers: 2 },
  { state: "READY", targetMembers: 2 },
  { state: "DISSOLUTION", targetMembers: 4 },
  { state: "RECRUITING", targetMembers: 3 },
  { state: "RECRUITING", targetMembers: 2 },
  { state: "RECRUITING", targetMembers: 2 },
  { state: "RECRUITING", targetMembers: 1 },
  { state: "RECRUITING", targetMembers: 1 },
  { state: "RECRUITING", targetMembers: 2 },
  { state: "DISBANDED", targetMembers: 3 },
  { state: "DISBANDED", targetMembers: 2 },
];

export async function runFullSpectrumSeed() {
  const categories = await prisma.jobCategory.findMany();
  if (categories.length === 0) {
    throw new Error("No job categories found - run the base seed first.");
  }

  // --- 50 new users: mixed FREE/SUBSCRIBER, mixed lookingForGroup ---
  const USER_COUNT = 50;
  const SUBSCRIBER_COUNT = 25;
  const tierAssignment = shuffle([
    ...Array(SUBSCRIBER_COUNT).fill("SUBSCRIBER"),
    ...Array(USER_COUNT - SUBSCRIBER_COUNT).fill("FREE"),
  ]);
  const lookingAssignment = shuffle([...Array(40).fill(true), ...Array(10).fill(false)]);

  type NewUser = { id: string; firstName: string; subscriptionTier: string };
  const users: NewUser[] = [];

  // Each run picks a fresh, non-overlapping phone block so re-running this
  // (e.g. to top up demo data later) never collides with an earlier batch.
  const existingCount = await prisma.user.count({ where: { phone: { startsWith: "+44700904" } } });

  for (let i = 1; i <= USER_COUNT; i++) {
    const n = existingCount + i;
    const phone = `+44700904${String(n).padStart(4, "0")}`;
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const band = i % 3;
    const maxMiles = band === 0 ? 10 : band === 1 ? 30 : 80;
    const coords = randomOffset(maxMiles);
    const subscriptionTier = tierAssignment[i - 1];

    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        firstName,
        age: randInt(19, 68),
        gender: pick(["Male", "Female", "Other"], 1)[0],
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        bio: `Hi, I'm ${firstName}! Happy to lend a hand with DIY and garden projects in exchange for help with mine.`,
        profileComplete: true,
        subscriptionTier,
        lookingForGroup: lookingAssignment[i - 1],
      },
    });
    users.push({ id: user.id, firstName: user.firstName!, subscriptionTier: user.subscriptionTier });
  }

  const userTasks: { id: string; ownerId: string; used: boolean }[] = [];
  for (const u of users) {
    for (let t = 0; t < 2; t++) {
      const category = pick(categories, 1)[0];
      const task = await prisma.task.create({
        data: {
          ownerId: u.id,
          name: `${category.name} help needed`,
          categoryId: category.id,
          description: `Looking for a hand with a ${category.name.toLowerCase()} job.`,
          estimatedManHours: randInt(2, 8),
          locationType: "HOME",
          locationLabel: "Lincolnshire, UK",
          status: "AVAILABLE",
        },
      });
      await prisma.taskPhoto.create({ data: { taskId: task.id, url: stockPhotoUrl(task.id) } });
      userTasks.push({ id: task.id, ownerId: u.id, used: false });
    }
  }

  const nextAvailableTask = (userId: string) => userTasks.find((t) => t.ownerId === userId && !t.used);

  const capacity = new Map<string, number>();
  for (const u of users) {
    capacity.set(u.id, u.subscriptionTier === "SUBSCRIBER" ? 6 : 1);
  }
  const nextMembers = (n: number, countsTowardLimit: boolean) => {
    const available = shuffle(users.filter((u) => !countsTowardLimit || (capacity.get(u.id) ?? 0) > 0));
    const out = available.slice(0, n);
    if (countsTowardLimit) {
      for (const u of out) capacity.set(u.id, (capacity.get(u.id) ?? 0) - 1);
    }
    return out;
  };

  let createdGroups = 0;
  let ratedUsers = 0;
  const groupLog: string[] = [];

  const batchTag = existingCount > 0 ? ` (batch ${Math.floor(existingCount / USER_COUNT) + 1})` : "";

  for (let i = 0; i < GROUP_NAMES.length; i++) {
    const name = `${GROUP_NAMES[i]}${batchTag}`;
    const plan = PLANS[i];
    const category = pick(categories, 1)[0];
    const sizeMin = 2;
    const sizeMax = Math.max(plan.targetMembers, randInt(4, 6));
    const countsTowardLimit = plan.state !== "DISBANDED";
    const members = nextMembers(plan.targetMembers, countsTowardLimit);
    if (members.length === 0) {
      groupLog.push(`Skipped "${name}" - no members with capacity left.`);
      continue;
    }
    const leader = members[0];
    const band = i % 3;
    const coords = randomOffset(band === 0 ? 8 : band === 1 ? 25 : 60);

    const group = await prisma.group.create({
      data: {
        name,
        description: `A friendly ${category.name.toLowerCase()} group swapping labour instead of money. ${
          plan.state === "RECRUITING" ? "Looking for a few more members to get started." : "Already up and running."
        }`,
        allowedCategories: { createMany: { data: categories.map((c) => ({ categoryId: c.id })) } },
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        sizeMin,
        sizeMax,
        leaderId: leader.id,
        state: plan.state === "DISSOLUTION" ? "WORKING" : plan.state,
      },
    });

    await prisma.groupMember.create({ data: { groupId: group.id, userId: leader.id, isLeader: true } });
    for (const m of members.slice(1)) {
      await prisma.groupMember.create({ data: { groupId: group.id, userId: m.id, isLeader: false } });
    }

    const isEffectivelyWorking = plan.state === "WORKING" || plan.state === "DISSOLUTION";
    const cycleCompletedAt = plan.state === "COMPLETED" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * randInt(3, 60)) : null;
    const cycle =
      plan.state === "DISBANDED"
        ? null
        : await prisma.groupCycle.create({
            data: {
              groupId: group.id,
              cycleNumber: 1,
              startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
              completedAt: cycleCompletedAt,
              taskOrder: JSON.stringify(members.map((m) => m.id)),
            },
          });

    const taskStatus =
      plan.state === "COMPLETED"
        ? "ARCHIVED"
        : isEffectivelyWorking
          ? "ACTIVE"
          : plan.state === "DISBANDED"
            ? null
            : "APPROVED";

    const memberTasks: { userId: string; taskId: string }[] = [];
    if (taskStatus && cycle) {
      for (const m of members) {
        const task = nextAvailableTask(m.id);
        if (!task) continue;
        task.used = true;
        memberTasks.push({ userId: m.id, taskId: task.id });
        await prisma.task.update({
          where: { id: task.id },
          data: { status: taskStatus, groupId: group.id, cycleId: cycle.id, activatedAt: isEffectivelyWorking ? new Date() : undefined },
        });
      }
    }

    if (plan.state === "COMPLETED" && cycle) {
      for (const rater of members) {
        for (const ratee of members) {
          if (rater.id === ratee.id) continue;
          const rateeTask = memberTasks.find((mt) => mt.userId === ratee.id);
          if (!rateeTask) continue;
          await prisma.ratingEvent.create({
            data: {
              taskId: rateeTask.taskId,
              raterId: rater.id,
              rateeId: ratee.id,
              type: ratee.id === leader.id ? "HOST" : "WORKER",
              scoreA: randInt(3, 5),
              scoreB: randInt(3, 5),
              scoreC: randInt(3, 5),
              visible: true,
              createdAt: cycleCompletedAt ?? new Date(),
            },
          });
        }
      }
      ratedUsers += members.length;
    }

    if (plan.state === "DISSOLUTION") {
      const requester = members[members.length - 1];
      const vote = await prisma.dissolutionVote.create({
        data: {
          groupId: group.id,
          requestedBy: requester.id,
          startedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
          endsAt: new Date(Date.now() + 1000 * 60 * 60 * 42),
        },
      });
      const ballotVoters = members.slice(0, Math.max(1, Math.floor(members.length / 2)));
      for (const voter of ballotVoters) {
        await prisma.dissolutionBallot.create({
          data: { voteId: vote.id, userId: voter.id, choice: voter.id === requester.id ? "YES" : pick(["YES", "NO"], 1)[0] },
        });
      }
      await prisma.group.update({ where: { id: group.id }, data: { state: "DISSOLUTION" } });
    }

    createdGroups++;
    groupLog.push(`Created "${name}" (${plan.state}) with ${members.length} member(s), led by ${leader.firstName}.`);
  }

  return {
    usersCreated: users.length,
    subscriberCount: SUBSCRIBER_COUNT,
    freeCount: USER_COUNT - SUBSCRIBER_COUNT,
    tasksCreated: userTasks.length,
    groupsCreated: createdGroups,
    ratedMemberSlots: ratedUsers,
    log: groupLog,
  };
}

// Every seed script (this one and the older one-off scripts in
// backend/scripts/) has always used +4470090xxxx phone numbers for the fake
// accounts it creates - a UK "personal numbering" range no real mobile uses,
// picked specifically so demo data is always unambiguously identifiable.
const DEMO_PHONE_PREFIX = "+4470090";

// Deletes every demo user/group/task EXCEPT ones a real account's history
// depends on. A demo user who leads or belongs to a group that also has a
// real (non-demo) member is left alone, along with that whole group and
// their task in it - that's how Rob's own account got its seeded rating
// and cycle history, and wiping it out would be a real, user-visible loss,
// not cleanup. Everything else (the anonymous demo-to-demo pool) is deleted.
export async function deleteDemoData() {
  const demoUsers = await prisma.user.findMany({
    where: { phone: { startsWith: DEMO_PHONE_PREFIX } },
    select: { id: true },
  });
  const demoUserIds = new Set(demoUsers.map((u) => u.id));
  if (demoUserIds.size === 0) {
    return { usersDeleted: 0, groupsDeleted: 0, tasksDeleted: 0, protectedUsers: 0, skippedGroups: 0 };
  }

  const demoLedGroups = await prisma.group.findMany({
    where: { leaderId: { in: [...demoUserIds] } },
    select: { id: true, leaderId: true, members: { select: { userId: true } } },
  });

  const entangledGroupIds = new Set<string>();
  const protectedUserIds = new Set<string>();
  for (const g of demoLedGroups) {
    const hasRealMember = g.members.some((m) => !demoUserIds.has(m.userId));
    if (hasRealMember) {
      entangledGroupIds.add(g.id);
      protectedUserIds.add(g.leaderId);
      for (const m of g.members) if (demoUserIds.has(m.userId)) protectedUserIds.add(m.userId);
    }
  }

  const deletableUserIds = [...demoUserIds].filter((id) => !protectedUserIds.has(id));
  const deletableGroupIds = demoLedGroups.filter((g) => !entangledGroupIds.has(g.id)).map((g) => g.id);

  if (deletableUserIds.length === 0) {
    return {
      usersDeleted: 0,
      groupsDeleted: 0,
      tasksDeleted: 0,
      protectedUsers: protectedUserIds.size,
      skippedGroups: entangledGroupIds.size,
    };
  }

  const deletableTasks = await prisma.task.findMany({ where: { ownerId: { in: deletableUserIds } }, select: { id: true } });
  const deletableTaskIds = deletableTasks.map((t) => t.id);

  // Deleted in dependency order - anything that references a User or Task
  // without a DB-level cascade has to go first, or the later deletes fail.
  const results = await prisma.$transaction([
    prisma.ratingEvent.deleteMany({ where: { OR: [{ raterId: { in: deletableUserIds } }, { rateeId: { in: deletableUserIds } }] } }),
    prisma.dissolutionBallot.deleteMany({ where: { userId: { in: deletableUserIds } } }),
    prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: deletableUserIds } }, { reportedUserId: { in: deletableUserIds } }] } }),
    prisma.groupChatMessage.deleteMany({ where: { senderId: { in: deletableUserIds } } }),
    prisma.groupApplication.deleteMany({ where: { OR: [{ applicantId: { in: deletableUserIds } }, { taskId: { in: deletableTaskIds } }] } }),
    prisma.groupInvitation.deleteMany({ where: { suggestedTaskId: { in: deletableTaskIds } } }),
    prisma.task.deleteMany({ where: { id: { in: deletableTaskIds } } }),
    prisma.group.deleteMany({ where: { id: { in: deletableGroupIds } } }),
    prisma.user.deleteMany({ where: { id: { in: deletableUserIds } } }),
  ]);

  const [, , , , , , tasksDeleted, groupsDeleted, usersDeleted] = results;

  return {
    usersDeleted: usersDeleted.count,
    groupsDeleted: groupsDeleted.count,
    tasksDeleted: tasksDeleted.count,
    protectedUsers: protectedUserIds.size,
    skippedGroups: entangledGroupIds.size,
  };
}
