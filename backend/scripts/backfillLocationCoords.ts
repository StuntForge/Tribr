import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { geocodeLabel } from "../src/services/geocode";

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const users = await prisma.user.findMany({
    where: { locationLabel: { not: null }, locationLat: null },
    select: { id: true, firstName: true, locationLabel: true },
  });

  console.log(`Found ${users.length} user(s) with a location label but no coordinates.`);

  let fixed = 0;
  for (const u of users) {
    const coords = await geocodeLabel(u.locationLabel!);
    if (coords) {
      await prisma.user.update({ where: { id: u.id }, data: { locationLat: coords.lat, locationLng: coords.lng } });
      console.log(`Geocoded ${u.firstName ?? u.id} (${u.locationLabel}) -> ${coords.lat}, ${coords.lng}`);
      fixed++;
    } else {
      console.log(`Could not geocode ${u.firstName ?? u.id} (${u.locationLabel})`);
    }
    // Nominatim's usage policy caps public requests at 1/second.
    await sleep(1100);
  }

  console.log(`\nBackfilled ${fixed} of ${users.length} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
