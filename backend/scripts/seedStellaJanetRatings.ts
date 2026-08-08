import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fabricate(firstName: string, targetScore: number, eventsPerCategory: number) {
  const target = await prisma.user.findFirst({ where: { firstName } });
  if (!target) {
    console.error(`No user found with firstName ${firstName}`);
    return;
  }

  const category = await prisma.jobCategory.findFirstOrThrow();
  const raters = await prisma.user.findMany({ where: { id: { not: target.id } }, take: eventsPerCategory * 2, select: { id: true } });
  if (raters.length < eventsPerCategory * 2) {
    console.error(`Not enough other users to act as raters for ${firstName}`);
    return;
  }

  const task = await prisma.task.create({
    data: {
      ownerId: target.id,
      name: "Fabricated rating history task",
      categoryId: category.id,
      description: "Backfilled task used to seed a realistic rating history.",
      estimatedManHours: 3,
      locationType: "HOME",
      locationLabel: "Lincolnshire, UK",
      status: "ARCHIVED",
    },
  });

  let raterIndex = 0;
  for (const type of ["WORKER", "HOST"] as const) {
    for (let i = 0; i < eventsPerCategory; i++) {
      const raterId = raters[raterIndex++].id;
      const wobble = () => Math.max(1, Math.min(5, targetScore + randInt(-1, 1)));
      await prisma.ratingEvent.create({
        data: {
          taskId: task.id,
          raterId,
          rateeId: target.id,
          type,
          scoreA: wobble(),
          scoreB: wobble(),
          scoreC: wobble(),
          visible: true,
          createdAt: new Date(Date.now() - randInt(1, 90) * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log(`Seeded ${eventsPerCategory * 2} rating events for ${firstName} (target score ~${targetScore}).`);
}

async function main() {
  // Score 5 x ~8 events/category overcomes the fixed neutral seed (weight 3,
  // score 3) enough to land Stella's overall rating in the low 4s.
  await fabricate("Stella", 5, 8);
  // Score 1 x ~15 events/category is needed to drag Janet's overall rating
  // down into the low 1s against that same neutral seed.
  await fabricate("Janet", 1, 15);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
