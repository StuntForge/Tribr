import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 11.x - Social Tribe activity categories, seeded once against production
// after the Social Tribes migration deploys (the category picker would
// otherwise be empty). Idempotent - safe to run more than once.
const SOCIAL_CATEGORIES = [
  "Hangout",
  "Food & Drink",
  "Music",
  "Games",
  "Sports & Fitness",
  "Outdoors",
  "Events",
  "Culture",
  "Classes & Learning",
  "Pets",
  "Family",
  "Other",
];

async function main() {
  for (const name of SOCIAL_CATEGORIES) {
    await prisma.jobCategory.upsert({
      where: { name },
      create: { name, kind: "SOCIAL" },
      update: { kind: "SOCIAL" },
    });
    console.log(`Ensured Social category "${name}".`);
  }
  console.log("Social category seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
