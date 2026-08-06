import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { computeRatingSummary } from "../services/ratings";
import { haversineMiles } from "../services/geo";

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
  const minRating = typeof req.query.minRating === "string" ? Number(req.query.minRating) : undefined;
  const maxDistanceMiles = typeof req.query.maxDistanceMiles === "string" ? Number(req.query.maxDistanceMiles) : undefined;

  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: [...blockedUserIds, req.userId!] },
      profileComplete: true,
      status: "ACTIVE",
      ...(query
        ? {
            OR: [
              { firstName: { contains: query } },
              { skills: { some: { label: { contains: query } } } },
              { tools: { some: { label: { contains: query } } } },
            ],
          }
        : {}),
      ...(categoryId ? { tasks: { some: { status: "AVAILABLE", categoryId } } } : {}),
    },
    include: {
      skills: true,
      tools: true,
      tasks: { where: { status: "AVAILABLE" }, include: { category: true } },
    },
    take: 50,
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
        approxDistanceMiles,
        overallRating: ratings.overallRating,
        workerRating: ratings.workerRating,
        hostRating: ratings.hostRating,
        skills: c.skills.map((s) => s.label),
        tools: c.tools.map((t) => t.label),
        activeTasks: c.tasks.map((t) => ({ id: t.id, name: t.name, category: t.category.name })),
      };
    })
  );

  const filtered = results.filter((r) => {
    if (maxDistanceMiles != null && (r.approxDistanceMiles == null || r.approxDistanceMiles > maxDistanceMiles)) return false;
    if (minRating != null && (r.overallRating == null || r.overallRating < minRating)) return false;
    return true;
  });

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
