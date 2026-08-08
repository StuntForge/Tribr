import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROB_PHONE = "07940206483";
const CENTER = { lat: 53.1699, lng: -0.1699 };

const FILLER_NAMES = ["Nina", "Oscar", "Priya", "Quinn", "Rosa", "Seb"];

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

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function makeFillerTask(ownerId: string, categories: { id: string; name: string }[], status: string, groupId?: string, cycleId?: string) {
  const category = pick(categories, 1)[0];
  return prisma.task.create({
    data: {
      ownerId,
      name: `${category.name} help needed`,
      categoryId: category.id,
      description: `Looking for a hand with a ${category.name.toLowerCase()} job.`,
      estimatedManHours: randInt(2, 8),
      locationType: "HOME",
      locationLabel: "Lincolnshire, UK",
      status,
      groupId: groupId ?? null,
      cycleId: cycleId ?? null,
    },
  });
}

// Same rating fabrication pattern as seedDemo.ts's COMPLETED groups - every
// member rates every other member on the task they brought to the cycle.
async function fabricateRatings(
  members: { userId: string; taskId: string }[],
  _leaderId: string,
  completedAt: Date
) {
  for (const rater of members) {
    for (const ratee of members) {
      if (rater.userId === ratee.userId) continue;
      await prisma.ratingEvent.create({
        data: {
          taskId: ratee.taskId,
          raterId: rater.userId,
          rateeId: ratee.userId,
          // ratee.taskId is always ratee's own task, so ratee is always the
          // host of it - the leaderId check here was wrong, it mistagged
          // some of these as WORKER ratings against the task's own owner.
          type: "HOST",
          scoreA: randInt(4, 5),
          scoreB: randInt(4, 5),
          scoreC: randInt(3, 5),
          visible: true,
          createdAt: completedAt,
        },
      });
    }
  }
}

interface FillerUser {
  id: string;
  firstName: string;
}

async function main() {
  const rob = await prisma.user.findFirst({ where: { phone: ROB_PHONE } });
  if (!rob) {
    console.error(`No user found with phone ${ROB_PHONE}`);
    process.exit(1);
  }

  const categories = await prisma.jobCategory.findMany();
  if (categories.length === 0) {
    console.error("No job categories found - run `npm run seed` first.");
    process.exit(1);
  }

  // A small dedicated cast of filler SUBSCRIBER users, so this script never
  // has to worry about eating into the capacity of users seeded elsewhere.
  const fillers: FillerUser[] = [];
  for (let i = 1; i <= FILLER_NAMES.length; i++) {
    const phone = `+44700902${String(i).padStart(4, "0")}`;
    const coords = randomOffset(20);
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        firstName: FILLER_NAMES[i - 1],
        age: randInt(25, 55),
        gender: pick(["Male", "Female", "Other"], 1)[0],
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        bio: `Hi, I'm ${FILLER_NAMES[i - 1]}! Happy to lend a hand with DIY and garden projects.`,
        profileComplete: true,
        subscriptionTier: "SUBSCRIBER",
      },
    });
    fillers.push({ id: user.id, firstName: user.firstName! });
  }
  console.log(`Created ${fillers.length} filler users for Rob's group history.`);

  const pool = [...fillers];
  const nextFillers = (n: number) => pick(pool, n);

  // Kept to 4 (not 5+) so Rob's active-membership count (4 here + 1 WORKING
  // group below = 5) stays under his SUBSCRIBER limit of 6, leaving room to
  // actually accept one of his pending invitations rather than maxing out.
  const COMPLETED_GROUPS = [
    { name: "Frithville Fence Finishers", robIsLeader: true, extraMembers: 2 },
    { name: "Kirton Kitchen Crew", robIsLeader: true, extraMembers: 3 },
    { name: "Boston Bedding Builders", robIsLeader: false, extraMembers: 2 },
    { name: "Sleaford Shed Squad", robIsLeader: false, extraMembers: 3 },
  ];

  for (const plan of COMPLETED_GROUPS) {
    const others = nextFillers(plan.extraMembers);
    const leaderId = plan.robIsLeader ? rob.id : others[0].id;
    const memberIds = [rob.id, ...others.map((o) => o.id)];
    const category = pick(categories, 1)[0];
    const coords = randomOffset(15);
    const completedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * randInt(10, 120));

    const group = await prisma.group.create({
      data: {
        name: plan.name,
        description: `A friendly ${category.name.toLowerCase()} group swapping labour instead of money. Already up and running.`,
        allowedCategories: { createMany: { data: categories.map((c) => ({ categoryId: c.id })) } },
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        sizeMin: 2,
        sizeMax: memberIds.length,
        leaderId,
        state: "COMPLETED",
      },
    });

    for (const userId of memberIds) {
      await prisma.groupMember.create({ data: { groupId: group.id, userId, isLeader: userId === leaderId } });
    }

    const cycle = await prisma.groupCycle.create({
      data: {
        groupId: group.id,
        cycleNumber: 1,
        startedAt: new Date(completedAt.getTime() - 1000 * 60 * 60 * 24 * 7),
        completedAt,
        taskOrder: JSON.stringify(memberIds),
      },
    });

    const members: { userId: string; taskId: string }[] = [];
    for (const userId of memberIds) {
      const task = await makeFillerTask(userId, categories, "ARCHIVED", group.id, cycle.id);
      members.push({ userId, taskId: task.id });
    }

    await fabricateRatings(members, leaderId, completedAt);

    console.log(`Created COMPLETED group "${plan.name}" (Rob ${plan.robIsLeader ? "led" : "was a member of"}, ${memberIds.length} members).`);
  }

  // --- One WORKING group Rob is a member (not leader) of, mid-cycle, with a
  // pending "confirm your availability" notification waiting for him. ---
  const workingLeader = nextFillers(1)[0];
  const doneMember = nextFillers(1)[0];
  const activeMember = nextFillers(1)[0];
  const workingMemberIds = [workingLeader.id, doneMember.id, activeMember.id, rob.id];
  const workingCategory = pick(categories, 1)[0];
  const workingCoords = randomOffset(15);

  const workingGroup = await prisma.group.create({
    data: {
      name: "Wainfleet Weekend Workforce",
      description: `A friendly ${workingCategory.name.toLowerCase()} group swapping labour instead of money. Already up and running.`,
      allowedCategories: { createMany: { data: categories.map((c) => ({ categoryId: c.id })) } },
      locationLabel: "Lincolnshire, UK",
      locationLat: workingCoords.lat,
      locationLng: workingCoords.lng,
      sizeMin: 2,
      sizeMax: workingMemberIds.length,
      leaderId: workingLeader.id,
      state: "WORKING",
    },
  });

  for (const userId of workingMemberIds) {
    await prisma.groupMember.create({ data: { groupId: workingGroup.id, userId, isLeader: userId === workingLeader.id } });
  }

  const workingCycle = await prisma.groupCycle.create({
    data: {
      groupId: workingGroup.id,
      cycleNumber: 1,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      taskOrder: "[]", // filled in below once we know the remaining task ids
    },
  });

  // Leader's and doneMember's tasks are already finished this cycle.
  const finishedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3);
  const leaderTask = await makeFillerTask(workingLeader.id, categories, "ARCHIVED", workingGroup.id, workingCycle.id);
  const doneTask = await makeFillerTask(doneMember.id, categories, "ARCHIVED", workingGroup.id, workingCycle.id);
  await fabricateRatings(
    [
      { userId: workingLeader.id, taskId: leaderTask.id },
      { userId: doneMember.id, taskId: doneTask.id },
    ],
    workingLeader.id,
    finishedAt
  );

  // activeMember's task is the one currently up - they've just proposed dates.
  const activeTask = await makeFillerTask(activeMember.id, categories, "ACTIVE", workingGroup.id, workingCycle.id);
  // Rob's task is next in the queue behind it, still just approved.
  const robTask = await makeFillerTask(rob.id, categories, "APPROVED", workingGroup.id, workingCycle.id);

  await prisma.groupCycle.update({
    where: { id: workingCycle.id },
    data: { taskOrder: JSON.stringify([activeTask.id, robTask.id]) },
  });

  const proposal = await prisma.availabilityProposal.create({
    data: {
      taskId: activeTask.id,
      options: {
        create: [
          { date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), allDay: true },
          { date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), allDay: true },
        ],
      },
    },
  });

  await prisma.groupChatMessage.create({
    data: { groupId: workingGroup.id, isSystem: true, text: `${activeTask.name}: new work dates proposed. Let the group know your availability.` },
  });

  // Notify every active member except the proposer - Rob's is left unread,
  // matching what he'd see fresh in his phone's Notification Centre.
  const notifyTargets = workingMemberIds.filter((id) => id !== activeMember.id);
  for (const userId of notifyTargets) {
    await prisma.notification.create({
      data: {
        userId,
        type: "DATES_PROPOSED",
        payload: JSON.stringify({
          title: "New dates proposed",
          body: `New possible work dates for ${activeTask.name}. Confirm your availability.`,
          groupId: workingGroup.id,
          taskId: activeTask.id,
        }),
        read: userId === rob.id ? false : Math.random() < 0.5,
      },
    });
  }

  console.log(`Created WORKING group "Wainfleet Weekend Workforce" - Rob is a member (not leader), 2 tasks already done, ${activeMember.firstName}'s task is active and awaiting availability, Rob has an unread notification to respond.`);
  console.log(`Availability proposal id: ${proposal.id}`);

  console.log("\nRob's group history seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
