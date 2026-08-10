import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { computeRatingSummary } from "../services/ratings";
import { haversineMiles } from "../services/geo";
import { JOB_LENGTHS } from "./tasks";

const router = Router();
router.use(requireAuth);

// 7.7 - leaders search for potential members instead of waiting for applications.
// Gated to Subscribers, matching 8.7's "advanced search filters" being a paid feature.
router.get("/members/search", async (req, res) => {
  const viewer = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (viewer.subscriptionTier !== "SUBSCRIBER") {
    return res.status(403).json({ error: "Searching for members is a Subscriber feature." });
  }

  const blockedPairs = await prisma.block.findMany({
    where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
  });
  const blockedUserIds = new Set(blockedPairs.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== req.userId));

  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const jobLength =
    typeof req.query.jobLength === "string" && (JOB_LENGTHS as readonly string[]).includes(req.query.jobLength)
      ? req.query.jobLength
      : undefined;
  const minRating = typeof req.query.minRating === "string" ? Number(req.query.minRating) : undefined;
  const maxDistanceMiles = typeof req.query.maxDistanceMiles === "string" ? Number(req.query.maxDistanceMiles) : undefined;
  const ageMin = typeof req.query.ageMin === "string" ? Number(req.query.ageMin) : undefined;
  const ageMax = typeof req.query.ageMax === "string" ? Number(req.query.ageMax) : undefined;
  const gender = typeof req.query.gender === "string" ? req.query.gender : undefined;
  const hasPhoto = req.query.hasPhoto === "true";
  const favouritesOnly = req.query.favouritesOnly === "true";

  let favouriteIds: string[] | undefined;
  if (favouritesOnly) {
    const favs = await prisma.favourite.findMany({ where: { ownerId: req.userId } });
    favouriteIds = favs.map((f) => f.favouriteUserId);
  }

  const ageFilter: { gte?: number; lte?: number } = {};
  if (ageMin != null && !Number.isNaN(ageMin)) ageFilter.gte = ageMin;
  if (ageMax != null && !Number.isNaN(ageMax)) ageFilter.lte = ageMax;

  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: [...blockedUserIds, req.userId!] },
      profileComplete: true,
      status: "ACTIVE",
      lookingForGroup: true,
      ...(query ? { firstName: { contains: query } } : {}),
      ...(categoryId || jobLength
        ? { tasks: { some: { status: "AVAILABLE", ...(categoryId ? { categoryId } : {}), ...(jobLength ? { jobLength } : {}) } } }
        : {}),
      ...(Object.keys(ageFilter).length > 0 ? { age: ageFilter } : {}),
      ...(gender ? { gender } : {}),
      ...(hasPhoto ? { profilePhotoUrl: { not: null } } : {}),
      ...(favouriteIds ? { id: { in: favouriteIds } } : {}),
    },
    include: {
      tasks: { where: { status: "AVAILABLE" }, include: { category: true } },
    },
    // No `take` here - capping before distance/relevance sorting silently
    // dropped arbitrary candidates (real bug: a genuine match sat at
    // position 51 in DB order and never made it into results at all,
    // regardless of how close or relevant they actually were). Cap after
    // sorting instead, below.
  });

  const results = await Promise.all(
    candidates.map(async (c) => {
      let approxDistanceMiles: number | null = null;
      if (viewer.locationLat != null && viewer.locationLng != null && c.locationLat != null && c.locationLng != null) {
        approxDistanceMiles = Math.round(haversineMiles(viewer.locationLat, viewer.locationLng, c.locationLat, c.locationLng) * 10) / 10;
      }
      const ratings = await computeRatingSummary(c.id);
      return {
        id: c.id,
        firstName: c.firstName,
        age: c.age,
        gender: c.gender,
        profilePhotoUrl: c.profilePhotoUrl,
        subscriptionTier: c.subscriptionTier,
        locationLat: c.locationLat,
        locationLng: c.locationLng,
        approxDistanceMiles,
        overallRating: ratings.overallRating,
        workerRating: ratings.workerRating,
        hostRating: ratings.hostRating,
        completedCycles: ratings.completedCycles,
        activeTasks: c.tasks.map((t) => ({ id: t.id, name: t.name, category: t.category.name, jobLength: t.jobLength })),
      };
    })
  );

  const filtered = results
    .filter((r) => {
      if (maxDistanceMiles != null && (r.approxDistanceMiles == null || r.approxDistanceMiles > maxDistanceMiles)) return false;
      if (minRating != null && (r.overallRating == null || r.overallRating < minRating)) return false;
      return true;
    })
    // Subscribers get priority placement in search results (8.7-style paid visibility perk),
    // then closest first within each tier.
    .sort((a, b) => {
      if (a.subscriptionTier !== b.subscriptionTier) return a.subscriptionTier === "SUBSCRIBER" ? -1 : 1;
      if (a.approxDistanceMiles == null) return b.approxDistanceMiles == null ? 0 : 1;
      if (b.approxDistanceMiles == null) return -1;
      return a.approxDistanceMiles - b.approxDistanceMiles;
    });

  // No cap: at real-world scale a leader browsing everyone "looking for a
  // group" would want pagination, but with a few dozen users total (mostly
  // seed data plus a handful of real testers) any fixed cap just hides
  // whoever the sort order happens to push last - which, in practice, is
  // exactly the real tester you're trying to find. Revisit with proper
  // pagination once the user base is large enough for it to matter.
  res.json(filtered);
});

// ---------- Favourites (7.9) ----------

router.get("/me/favourites", async (req, res) => {
  const favourites = await prisma.favourite.findMany({
    where: { ownerId: req.userId },
    include: { favouriteUser: true },
    orderBy: { createdAt: "desc" },
  });

  const results = await Promise.all(
    favourites.map(async (f) => ({
      userId: f.favouriteUserId,
      firstName: f.favouriteUser.firstName,
      isPro: f.favouriteUser.subscriptionTier === "SUBSCRIBER",
      overallRating: (await computeRatingSummary(f.favouriteUserId)).overallRating,
    }))
  );

  res.json(results);
});

router.post("/me/favourites", async (req, res) => {
  const userId = String(req.body.userId ?? "");
  if (!userId) return res.status(400).json({ error: "userId is required." });
  if (userId === req.userId) return res.status(400).json({ error: "You can't favourite yourself." });

  await prisma.favourite.upsert({
    where: { ownerId_favouriteUserId: { ownerId: req.userId!, favouriteUserId: userId } },
    create: { ownerId: req.userId!, favouriteUserId: userId },
    update: {},
  });

  res.status(201).json({ ok: true });
});

router.delete("/me/favourites/:userId", async (req, res) => {
  await prisma.favourite.deleteMany({ where: { ownerId: req.userId, favouriteUserId: req.params.userId } });
  res.json({ ok: true });
});

export default router;
