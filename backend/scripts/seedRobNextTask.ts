import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROB_PHONE = "07940206483";
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

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fabricateRatings(members: { userId: string; taskId: string }[], leaderId: string, completedAt: Date) {
  for (const rater of members) {
    for (const ratee of members) {
      if (rater.userId === ratee.userId) continue;
      await prisma.ratingEvent.create({
        data: {
          taskId: ratee.taskId,
          raterId: rater.userId,
          rateeId: ratee.userId,
          type: ratee.userId === leaderId ? "HOST" : "WORKER",
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

  const leaderCoords = randomOffset(15);
  const leader = await prisma.user.create({
    data: {
      phone: `+447009030001`,
      phoneVerifiedAt: new Date(),
      acceptedTermsAt: new Date(),
      firstName: "Tara",
      age: randInt(28, 50),
      gender: "Female",
      locationLabel: "Lincolnshire, UK",
      locationLat: leaderCoords.lat,
      locationLng: leaderCoords.lng,
      bio: "Happy to lead a friendly group and get things moving.",
      profileComplete: true,
      subscriptionTier: "SUBSCRIBER",
    },
  });
  const otherCoords = randomOffset(15);
  const other = await prisma.user.create({
    data: {
      phone: `+447009030002`,
      phoneVerifiedAt: new Date(),
      acceptedTermsAt: new Date(),
      firstName: "Umar",
      age: randInt(28, 50),
      gender: "Male",
      locationLabel: "Lincolnshire, UK",
      locationLat: otherCoords.lat,
      locationLng: otherCoords.lng,
      bio: "Always up for a garden or DIY job.",
      profileComplete: true,
      subscriptionTier: "SUBSCRIBER",
    },
  });

  const memberIds = [leader.id, other.id, rob.id];
  const category = pick(categories, 1)[0];
  const coords = randomOffset(15);

  const group = await prisma.group.create({
    data: {
      name: "Heckington Handy Helpers",
      description: `A friendly ${category.name.toLowerCase()} group swapping labour instead of money. Already up and running.`,
      allowedCategories: { createMany: { data: categories.map((c) => ({ categoryId: c.id })) } },
      locationLabel: "Lincolnshire, UK",
      locationLat: coords.lat,
      locationLng: coords.lng,
      sizeMin: 2,
      sizeMax: 3,
      leaderId: leader.id,
      state: "WORKING",
    },
  });

  for (const userId of memberIds) {
    await prisma.groupMember.create({ data: { groupId: group.id, userId, isLeader: userId === leader.id } });
  }

  const cycle = await prisma.groupCycle.create({
    data: {
      groupId: group.id,
      cycleNumber: 1,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
      taskOrder: "[]",
    },
  });

  const completedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 4);
  const leaderTask = await prisma.task.create({
    data: {
      ownerId: leader.id,
      name: `${category.name} help needed`,
      categoryId: category.id,
      description: `Looking for a hand with a ${category.name.toLowerCase()} job.`,
      estimatedManHours: randInt(2, 8),
      locationType: "HOME",
      locationLabel: "Lincolnshire, UK",
      status: "ARCHIVED",
      groupId: group.id,
      cycleId: cycle.id,
    },
  });
  const otherTask = await prisma.task.create({
    data: {
      ownerId: other.id,
      name: `${category.name} help needed`,
      categoryId: category.id,
      description: `Looking for a hand with a ${category.name.toLowerCase()} job.`,
      estimatedManHours: randInt(2, 8),
      locationType: "HOME",
      locationLabel: "Lincolnshire, UK",
      status: "ARCHIVED",
      groupId: group.id,
      cycleId: cycle.id,
    },
  });
  await fabricateRatings(
    [
      { userId: leader.id, taskId: leaderTask.id },
      { userId: other.id, taskId: otherTask.id },
    ],
    leader.id,
    completedAt
  );

  // Rob's task is the one currently active - next up in the queue with
  // nothing ahead of it, matching "we've completed 2 tasks and it's my
  // task next".
  const robTask = await prisma.task.create({
    data: {
      ownerId: rob.id,
      name: "Trim the back hedge and tidy the borders",
      categoryId: category.id,
      description: "Hedge needs a trim and the borders could do with a weed and tidy.",
      estimatedManHours: randInt(2, 6),
      locationType: "HOME",
      locationLabel: "Lincolnshire, UK",
      status: "ACTIVE",
      groupId: group.id,
      cycleId: cycle.id,
    },
  });

  await prisma.groupCycle.update({
    where: { id: cycle.id },
    data: { taskOrder: JSON.stringify([robTask.id]) },
  });

  await prisma.groupChatMessage.create({
    data: {
      groupId: group.id,
      isSystem: true,
      text: `${leaderTask.name} and ${otherTask.name} are done. ${robTask.name} is up next.`,
    },
  });

  console.log(
    `Created WORKING group "Heckington Handy Helpers" - Rob is a member (not leader), 2 tasks completed (${leader.firstName}'s, ${other.firstName}'s), Rob's task "${robTask.name}" is active and next in the queue.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
