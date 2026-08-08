import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Chloe", "Liam", "Emily", "Ryan", "Sophie",
  "Jack", "Amelia", "Josh", "Ella", "Callum", "Freya", "Dan", "Grace",
  "Ben", "Lucy", "Tom", "Isla", "Harry", "Poppy", "Owen", "Mia",
  "Leo", "Erin", "Finn", "Ruby", "Max", "Zoe",
];

// Same Frithville centre point as seedDemo.ts, so this batch scatters
// realistically around the real SUBSCRIBER test account's location.
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

const GROUP_NAMES = [
  "Skegness Seaside Fixers",
  "Louth Landscaping Crew",
  "Grantham Garden Gang",
  "Stamford Stonework Squad",
  "Gainsborough Decorating Team",
  "Market Rasen Roofers",
  "Alford DIY Collective",
  "Wragby Woodworkers",
  "Billinghay Bathroom Crew",
  "Metheringham Kitchen Fitters",
  "Ruskington Renovation Ring",
  "Heckington Handy Helpers",
  "Donington Decking Group",
  "Holbeach Home Improvers",
  "Long Sutton Painters",
  "Bourne Plastering Pros",
  "Grimsby Electrics Exchange",
  "Cleethorpes Plumbing Crew",
  "Mablethorpe Odd Jobs Squad",
  "Wainfleet Flooring Fixers",
];

async function main() {
  const categories = await prisma.jobCategory.findMany();
  if (categories.length === 0) {
    console.error("No job categories found - run `npm run seed` first.");
    process.exit(1);
  }

  // --- 50 new users, all looking for a group, 40 of them SUBSCRIBER ---
  const USER_COUNT = 50;
  const SUBSCRIBER_COUNT = 40;
  const tierAssignment = shuffle([
    ...Array(SUBSCRIBER_COUNT).fill("SUBSCRIBER"),
    ...Array(USER_COUNT - SUBSCRIBER_COUNT).fill("FREE"),
  ]);

  type NewUser = { id: string; firstName: string; subscriptionTier: string };
  const users: NewUser[] = [];

  for (let i = 1; i <= USER_COUNT; i++) {
    const phone = `+44700901${String(i).padStart(4, "0")}`;
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
        age: randInt(21, 62),
        gender: pick(["Male", "Female", "Other"], 1)[0],
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        bio: `Hi, I'm ${firstName}! Happy to lend a hand with DIY and garden projects in exchange for help with mine.`,
        profileComplete: true,
        subscriptionTier,
        lookingForGroup: true,
      },
    });
    users.push({ id: user.id, firstName: user.firstName!, subscriptionTier: user.subscriptionTier });

    // Two baseline tasks per user that are never linked to a group - these
    // guarantee every user always has AVAILABLE tasks showing on their
    // profile, no matter how many groups they end up joining below.
    for (let t = 0; t < 2; t++) {
      const category = pick(categories, 1)[0];
      await prisma.task.create({
        data: {
          ownerId: user.id,
          name: `${category.name} help needed`,
          categoryId: category.id,
          description: `Looking for a hand with a ${category.name.toLowerCase()} job.`,
          estimatedManHours: randInt(2, 8),
          locationType: "HOME",
          locationLabel: "Lincolnshire, UK",
          status: "AVAILABLE",
        },
      });
    }
  }
  console.log(`Created ${users.length} demo users (${SUBSCRIBER_COUNT} SUBSCRIBER / ${USER_COUNT - SUBSCRIBER_COUNT} FREE), all lookingForGroup=true, each with 2 AVAILABLE tasks.`);

  // --- 20 new RECRUITING groups, members drawn from the pool above ---
  // Respect the same FREE(1)/SUBSCRIBER(6) active-group limit the app
  // enforces, so no seeded free-tier user ends up in two active groups.
  const capacity = new Map<string, number>();
  for (const u of users) {
    capacity.set(u.id, u.subscriptionTier === "SUBSCRIBER" ? 6 : 1);
  }

  const takeMembers = (n: number, requireLeaderCandidate: boolean) => {
    const pool = users.filter((u) => (capacity.get(u.id) ?? 0) > 0);
    if (pool.length === 0) return [];
    let leaderPool = requireLeaderCandidate ? pool.filter((u) => u.subscriptionTier === "SUBSCRIBER") : pool;
    if (leaderPool.length === 0) leaderPool = pool;
    const leader = pick(leaderPool, 1)[0];
    const rest = pick(
      pool.filter((u) => u.id !== leader.id),
      Math.max(0, n - 1)
    );
    const chosen = [leader, ...rest];
    for (const u of chosen) capacity.set(u.id, (capacity.get(u.id) ?? 0) - 1);
    return chosen;
  };

  let createdGroups = 0;

  for (let i = 0; i < GROUP_NAMES.length; i++) {
    const name = GROUP_NAMES[i];
    const category = pick(categories, 1)[0];
    const sizeMin = 2;
    const sizeMax = randInt(4, 8);
    const targetMembers = randInt(2, Math.min(5, sizeMax));
    const members = takeMembers(targetMembers, true);
    if (members.length === 0) {
      console.log(`Skipped "${name}" - no members with capacity left.`);
      continue;
    }
    const leader = members[0];
    const band = i % 3;
    const coords = randomOffset(band === 0 ? 8 : band === 1 ? 25 : 60);

    const group = await prisma.group.create({
      data: {
        name,
        description: `A friendly ${category.name.toLowerCase()} group swapping labour instead of money. Looking for a few more members to get started.`,
        allowedCategories: { createMany: { data: categories.map((c) => ({ categoryId: c.id })) } },
        locationLabel: "Lincolnshire, UK",
        locationLat: coords.lat,
        locationLng: coords.lng,
        sizeMin,
        sizeMax,
        leaderId: leader.id,
        state: "RECRUITING",
      },
    });

    await prisma.groupMember.create({ data: { groupId: group.id, userId: leader.id, isLeader: true } });
    for (const m of members.slice(1)) {
      await prisma.groupMember.create({ data: { groupId: group.id, userId: m.id, isLeader: false } });
    }

    const cycle = await prisma.groupCycle.create({
      data: {
        groupId: group.id,
        cycleNumber: 1,
        startedAt: new Date(),
        taskOrder: JSON.stringify(members.map((m) => m.id)),
      },
    });

    // Each member's group-linked task is a fresh one created straight into
    // APPROVED status, so it never touches their two guaranteed-AVAILABLE tasks.
    for (const m of members) {
      const memberCategory = pick(categories, 1)[0];
      await prisma.task.create({
        data: {
          ownerId: m.id,
          name: `${memberCategory.name} help needed`,
          categoryId: memberCategory.id,
          description: `Looking for a hand with a ${memberCategory.name.toLowerCase()} job.`,
          estimatedManHours: randInt(2, 8),
          locationType: "HOME",
          locationLabel: "Lincolnshire, UK",
          status: "APPROVED",
          groupId: group.id,
          cycleId: cycle.id,
        },
      });
    }

    createdGroups++;
    console.log(`Created group "${name}" (RECRUITING) with ${members.length} member(s), led by ${leader.firstName}.`);
  }

  console.log(`\nSeeded ${createdGroups} RECRUITING groups. Expansion seed complete.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
