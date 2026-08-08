import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 3.3 - initial job categories
const CATEGORIES = ["Gardening", "Moving & Lifting", "DIY & General", "Decorating"];

async function main() {
  for (const name of CATEGORIES) {
    await prisma.jobCategory.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`Seeded ${CATEGORIES.length} job categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
