import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Chloe", "Liam", "Emily", "Ryan", "Sophie",
  "Jack", "Amelia", "Josh", "Ella", "Callum", "Freya", "Dan", "Grace",
  "Ben", "Lucy", "Tom", "Isla",
];

// Frithville, Lincolnshire - matches the real SUBSCRIBER test account's
// location label so distance-based search has a meaningful centre point.
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

async function fixRealUserLocations() {
  const knownPlaces: Record<string, { lat: number; lng: number }> = {
    "Frithville, Uk": CENTER,
    "Bristol, UK": { lat: 51.4545, lng: -2.5879 },
  };
  const users = await prisma.user.findMany({ where: { locationLat: null, locationLabel: { not: null } } });
  for (const u of users) {
    const coords = u.locationLabel ? knownPlaces[u.locationLabel] : undefined;
    if (coords) {
      await prisma.user.update({ where: { id: u.id }, data: { locationLat: coords.lat, locationLng: coords.lng } });
      console.log(`Geocoded ${u.firstName ?? u.id} (${u.locationLabel}) -> ${coords.lat}, ${coords.lng}`);
    }
  }
}

async function main() {
  await fixRealUserLocations();

  const categories = await prisma.jobCategory.findMany();
  if (categories.length === 0) {
    console.error("No job categories found - run `npm run seed` first.");
    process.exit(1);
  }

  const userCount = 18;
  const demoUsers: { id: string; firstName: string; subscriptionTier: string }[] = [];

  for (let i = 1; i <= userCount; i++) {
    const phone = `+44700900${String(i).padStart(4, "0")}`;
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const band = i % 3;
    const maxMiles = band === 0 ? 10 : band === 1 ? 30 : 80;
    const coords = randomOffset(maxMiles);
    const isSubscriber = i % 3 === 0;

    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        firstName,
        age: randInt(21, 62),
        gender: pick(["Male", "Female", "Other"], 1)[0],
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        bio: `Hi, I'm ${firstName}! Happy to lend a hand with DIY and garden projects in exchange for help with mine.`,
        profileComplete: true,
        subscriptionTier: isSubscriber ? "SUBSCRIBER" : "FREE",
      },
    });
    demoUsers.push({ id: user.id, firstName: user.firstName!, subscriptionTier: user.subscriptionTier });
  }
  console.log(`Created ${demoUsers.length} demo users.`);

  // Every demo user gets 2 tasks: one to bring to a group, one left spare so
  // search/invite flows always have something available to pick from.
  const demoTasks: { id: string; ownerId: string; used: boolean }[] = [];
  for (const u of demoUsers) {
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
      demoTasks.push({ id: task.id, ownerId: u.id, used: false });
    }
  }
  console.log(`Created ${demoTasks.length} demo tasks (2 per user).`);

  const nextAvailableTask = (userId: string) => demoTasks.find((t) => t.ownerId === userId && !t.used);

  const GROUP_NAMES = [
    "Sleaford Tiling Team",
    "Horncastle Handy Group",
    "Woodhall Spa Garden Gang",
    "Spalding Landscapers",
    "Coningsby Carpenters",
    "Frithville Fixers",
    "Kirton DIY Exchange",
    "Lincs Fence & Garden Crew",
    "Boston Decking Squad",
    "Weekend Painters Collective",
  ];

  type GroupPlan = { state: string; targetMembers: number };
  // COMPLETED groups are listed first so they get first pick of member
  // capacity - that maximises how many demo users end up with a real
  // completed-cycle rating history.
  const plans: GroupPlan[] = [
    { state: "COMPLETED", targetMembers: 5 },
    { state: "COMPLETED", targetMembers: 5 },
    { state: "COMPLETED", targetMembers: 4 },
    { state: "WORKING", targetMembers: 4 },
    { state: "WORKING", targetMembers: 3 },
    { state: "READY", targetMembers: 3 },
    { state: "READY", targetMembers: 2 },
    { state: "RECRUITING", targetMembers: 2 },
    { state: "RECRUITING", targetMembers: 1 },
    { state: "DISBANDED", targetMembers: 3 },
  ];

  // Respect the same FREE(1)/SUBSCRIBER(6) active-group limit the app
  // enforces, so seeded free-tier users don't end up in two active groups.
  // DISBANDED groups don't count against the limit (matches activeMembershipCount).
  const capacity = new Map<string, number>();
  for (const u of demoUsers) {
    capacity.set(u.id, u.subscriptionTier === "SUBSCRIBER" ? 6 : 1);
  }
  const nextMembers = (n: number, countsTowardLimit: boolean) => {
    const available = demoUsers.filter((u) => !countsTowardLimit || (capacity.get(u.id) ?? 0) > 0);
    const out = available.slice(0, n);
    if (countsTowardLimit) {
      for (const u of out) capacity.set(u.id, (capacity.get(u.id) ?? 0) - 1);
    }
    return out;
  };

  let createdGroups = 0;
  let ratedUsers = 0;

  // Two RECRUITING demo groups get an eligibility gate switched on, so the
  // verified-only / minimum-rating apply restrictions have something to test.
  const GATES: Record<string, { verifiedOnly?: boolean; minRating?: number }> = {
    "Lincs Fence & Garden Crew": { verifiedOnly: true },
    "Boston Decking Squad": { minRating: 3.5 },
  };

  for (let i = 0; i < GROUP_NAMES.length; i++) {
    const name = GROUP_NAMES[i];
    const plan = plans[i];
    const category = pick(categories, 1)[0];
    const sizeMin = 2;
    const sizeMax = Math.max(plan.targetMembers, randInt(4, 6));
    const countsTowardLimit = plan.state !== "DISBANDED";
    const members = nextMembers(plan.targetMembers, countsTowardLimit);
    if (members.length === 0) {
      console.log(`Skipped "${name}" - no members with capacity left.`);
      continue;
    }
    const leader = members[0];
    const band = i % 3;
    const coords = randomOffset(band === 0 ? 8 : band === 1 ? 25 : 60);
    const gate = GATES[name] ?? {};

    const group = await prisma.group.create({
      data: {
        name,
        description: `A friendly ${category.name.toLowerCase()} group swapping labour instead of money. ${
          plan.state === "RECRUITING" ? "Looking for a few more members to get started." : "Already up and running."
        }`,
        // All categories allowed so any demo user's randomly-assigned tasks
        // are guaranteed valid to join with (keeps the fixture data internally consistent).
        allowedCategories: { createMany: { data: categories.map((c) => ({ categoryId: c.id })) } },
        verifiedOnly: gate.verifiedOnly ?? false,
        minRating: gate.minRating,
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        sizeMin,
        sizeMax,
        leaderId: leader.id,
        state: plan.state,
      },
    });

    await prisma.groupMember.create({ data: { groupId: group.id, userId: leader.id, isLeader: true } });
    for (const m of members.slice(1)) {
      await prisma.groupMember.create({ data: { groupId: group.id, userId: m.id, isLeader: false } });
    }

    // Every member joins the group with one of their own tasks - group
    // membership always means "I brought this specific task along".
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
      plan.state === "COMPLETED" ? "ARCHIVED" : plan.state === "WORKING" ? "ACTIVE" : plan.state === "DISBANDED" ? null : "APPROVED";

    const memberTasks: { userId: string; taskId: string }[] = [];
    if (taskStatus && cycle) {
      for (const m of members) {
        const task = nextAvailableTask(m.id);
        if (!task) continue;
        task.used = true;
        memberTasks.push({ userId: m.id, taskId: task.id });
        await prisma.task.update({
          where: { id: task.id },
          data: { status: taskStatus, groupId: group.id, cycleId: cycle.id },
        });
      }
    }

    // Fabricate rating history for completed groups - lets the whole
    // membership show up with a real worker/host rating and a completed
    // cycle instead of "No ratings yet".
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

    createdGroups++;
    console.log(`Created group "${name}" (${plan.state}) with ${members.length} member(s)`);
  }

  console.log(`\nSeeded ${createdGroups} groups; fabricated ratings for ~${ratedUsers} member-slots. Demo data seed complete.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
