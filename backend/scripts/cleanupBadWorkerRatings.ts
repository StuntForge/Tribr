import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// A WORKER rating recorded against the owner of the task it's tied to is
// never valid - the owner is always the host of their own task. Cleans up
// bad rows left by an earlier seed-script bug (fabricateRatings tied
// WORKER/HOST to "is ratee the group leader" instead of "is ratee this
// task's owner").
async function main() {
  const events = await prisma.ratingEvent.findMany({
    where: { type: "WORKER" },
    include: { task: true },
  });
  const bad = events.filter((e) => e.task.ownerId === e.rateeId);
  console.log(`Found ${bad.length} bad WORKER rating(s) recorded against a task's own owner.`);
  if (bad.length > 0) {
    await prisma.ratingEvent.deleteMany({ where: { id: { in: bad.map((e) => e.id) } } });
    console.log("Deleted.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
