import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_CATEGORIES = ["Gardening", "Moving & Lifting", "DIY & General", "Decorating"];

// Old category name -> new category name. "Gardening" and "Decorating" are
// kept as-is since they exist in both lists.
const REMAP: Record<string, string> = {
  Landscaping: "Gardening",
  Cleaning: "DIY & General",
  Carpentry: "DIY & General",
  "General DIY": "DIY & General",
  Painting: "Decorating",
  Moving: "Moving & Lifting",
  Organisation: "DIY & General",
  Other: "DIY & General",
};

async function main() {
  const newCategoryByName = new Map<string, string>();
  for (const name of NEW_CATEGORIES) {
    const cat = await prisma.jobCategory.upsert({ where: { name }, create: { name }, update: {} });
    newCategoryByName.set(name, cat.id);
  }

  const oldCategories = await prisma.jobCategory.findMany({ where: { name: { in: Object.keys(REMAP) } } });

  for (const old of oldCategories) {
    const newName = REMAP[old.name];
    const newId = newCategoryByName.get(newName)!;

    const [taskCount, groupCount] = await Promise.all([
      prisma.task.updateMany({ where: { categoryId: old.id }, data: { categoryId: newId } }),
      prisma.group.updateMany({ where: { categoryId: old.id }, data: { categoryId: newId } }),
    ]);

    await prisma.jobCategory.delete({ where: { id: old.id } });
    console.log(`Migrated "${old.name}" -> "${newName}" (${taskCount.count} tasks, ${groupCount.count} groups), deleted old category.`);
  }

  console.log("Category migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
