import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROB_PHONE = "07940206483";

// A handful of the newly-seeded RECRUITING groups (see seedDemoExpansion.ts)
// that invite Rob's real account in, so he has several pending invitations
// to test the accept/decline flow with on his phone.
const INVITING_GROUPS = [
  "Skegness Seaside Fixers",
  "Grantham Garden Gang",
  "Wragby Woodworkers",
  "Holbeach Home Improvers",
  "Grimsby Electrics Exchange",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

  // Fresh AVAILABLE tasks for Rob to be invited with - his existing tasks
  // were all APPROVED/DRAFT, leaving nothing eligible to suggest.
  const tasks = [];
  for (const category of categories.slice(0, 2)) {
    const task = await prisma.task.create({
      data: {
        ownerId: rob.id,
        name: `${category.name} help needed`,
        categoryId: category.id,
        description: `Looking for a hand with a ${category.name.toLowerCase()} job.`,
        estimatedManHours: randInt(2, 8),
        locationType: "HOME",
        locationLabel: rob.locationLabel ?? "Frithville, Uk",
        status: "AVAILABLE",
      },
    });
    tasks.push(task);
  }
  console.log(`Created ${tasks.length} fresh AVAILABLE tasks for Rob.`);

  let created = 0;
  for (let i = 0; i < INVITING_GROUPS.length; i++) {
    const group = await prisma.group.findFirst({ where: { name: INVITING_GROUPS[i] } });
    if (!group) {
      console.log(`Skipped "${INVITING_GROUPS[i]}" - group not found.`);
      continue;
    }
    const existing = await prisma.groupInvitation.findFirst({
      where: { groupId: group.id, invitedUserId: rob.id, status: "PENDING" },
    });
    if (existing) {
      console.log(`Skipped "${INVITING_GROUPS[i]}" - Rob already has a pending invitation from this group.`);
      continue;
    }
    const task = tasks[i % tasks.length];
    await prisma.groupInvitation.create({
      data: { groupId: group.id, invitedUserId: rob.id, suggestedTaskId: task.id },
    });
    created++;
    console.log(`Invited Rob to "${group.name}" (task: ${task.name}).`);
  }

  console.log(`\nCreated ${created} pending invitations for Rob.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
