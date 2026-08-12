import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { computeRatingBreakdown, computeRatingSummary } from "../services/ratings";
import { computeSocialReliability } from "../services/socialReliability";
import { haversineMiles } from "../services/geo";
import { geocodeLabel } from "../services/geocode";

const router = Router();
router.use(requireAuth);

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "No Seafood",
  "Lactose Intolerant",
  "Kosher",
  "Halal",
  "Food Allergies",
];

function serializePrivateProfile(
  user: any,
  ratings: Awaited<ReturnType<typeof computeRatingSummary>>,
  completedTasksCount: number,
  socialReliability: Awaited<ReturnType<typeof computeSocialReliability>>
) {
  return {
    id: user.id,
    phone: user.phone,
    firstName: user.firstName,
    age: user.age,
    gender: user.gender,
    locationLabel: user.locationLabel,
    locationLat: user.locationLat,
    locationLng: user.locationLng,
    homeAddress: user.homeAddress,
    bio: user.bio,
    profilePhotoUrl: user.profilePhotoUrl,
    profileComplete: user.profileComplete,
    subscriptionTier: user.subscriptionTier,
    lookingForGroup: user.lookingForGroup,
    dietary: user.dietary?.map((d: any) => d.type) ?? [],
    allergyDetail: user.dietary?.find((d: any) => d.type === "Food Allergies")?.detail ?? null,
    photos: user.photos?.map((p: any) => ({ id: p.id, url: p.url })) ?? [],
    overallRating: ratings.overallRating,
    workerRating: ratings.workerRating,
    hostRating: ratings.hostRating,
    completedCycles: ratings.completedCycles,
    completedTasksCount,
    // Social Reliability (11.13) - always shown separately from the star
    // rating above, never blended into it.
    socialReliability,
  };
}

async function countCompletedTasks(userId: string) {
  // Tasks never actually rest in a "COMPLETED" status - completeTask (groups.ts)
  // moves them straight to ARCHIVED, matching computeRatingSummary's own check.
  return prisma.task.count({ where: { ownerId: userId, status: "ARCHIVED" } });
}

function isProfileComplete(u: {
  firstName: string | null;
  age: number | null;
  gender: string | null;
  locationLabel: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
}) {
  return Boolean(u.firstName && u.age && u.gender && u.locationLabel && u.bio && u.profilePhotoUrl);
}

router.get("/me", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { dietary: true, photos: true },
  });
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json(
    serializePrivateProfile(
      user,
      await computeRatingSummary(user.id),
      await countCompletedTasks(user.id),
      await computeSocialReliability(user.id)
    )
  );
});

// Sub-score breakdown behind the Home screen's headline rating - fetched on
// demand only when the user expands it, so it doesn't weigh down every /me call.
router.get("/me/rating-breakdown", async (req, res) => {
  res.json(await computeRatingBreakdown(req.userId!));
});

router.put("/me/looking-for-group", async (req, res) => {
  const lookingForGroup = Boolean(req.body.lookingForGroup);
  const updated = await prisma.user.update({ where: { id: req.userId }, data: { lookingForGroup } });
  res.json({ lookingForGroup: updated.lookingForGroup });
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  age: z.number().int().min(16).max(120).optional(),
  gender: z.string().min(1).max(50).optional(),
  locationLabel: z.string().min(1).max(120).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  bio: z.string().max(1000).optional(),
  profilePhotoUrl: z.string().url().optional(),
});

// 2.3/2.4/2.11 - users may edit most of their profile at any time. Age and
// gender are the exception: they're only settable once, during onboarding
// (existing.age/gender null). Locking them in stops the "get a bad rating,
// wipe it by changing details, look like a new person" pattern - phone
// number (immutable, see auth.ts) is the real identity anchor, but age/
// gender free-editing would still let someone launder a damaged reputation
// enough to dodge casual pattern-matching by other members.
router.put("/me", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

  if (parsed.data.age != null && existing.age != null && parsed.data.age !== existing.age) {
    return res.status(400).json({ error: "Age can't be changed once your account is created." });
  }
  if (parsed.data.gender != null && existing.gender != null && parsed.data.gender !== existing.gender) {
    return res.status(400).json({ error: "Gender can't be changed once your account is created." });
  }

  const merged = { ...existing, ...parsed.data };

  // Only "Use my current location" sends real coordinates from the app;
  // anyone who just types a location (very common - it's not obvious GPS
  // permission is what map visibility actually depends on) would otherwise
  // save with no lat/lng and silently never show up on any map view.
  let geocoded: { lat: number; lng: number } | null = null;
  if (
    parsed.data.locationLabel &&
    parsed.data.locationLat == null &&
    parsed.data.locationLng == null &&
    parsed.data.locationLabel !== existing.locationLabel
  ) {
    geocoded = await geocodeLabel(parsed.data.locationLabel);
  }

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...parsed.data,
      ...(geocoded ? { locationLat: geocoded.lat, locationLng: geocoded.lng } : {}),
      profileComplete: isProfileComplete(merged),
    },
    include: { dietary: true, photos: true },
  });

  res.json(
    serializePrivateProfile(
      updated,
      await computeRatingSummary(updated.id),
      await countCompletedTasks(updated.id),
      await computeSocialReliability(updated.id)
    )
  );
});

// ---- Mobile number change / self-service account deletion - DISABLED. ----
// The phone number is a user's unique account identity, and self-deletion
// was the other half of a real abuse pattern: join a group, do the minimum,
// skip helping others, rack up bad ratings, delete, sign up again clean.
// Locking both closed means a damaged reputation actually has to be lived
// with rather than laundered away. Routes are kept (rather than removed) so
// the reasoning stays visible in code and any future admin-initiated flow
// has a clear place to live.

router.post("/me/change-phone/request", async (_req, res) => {
  res.status(403).json({ error: "Mobile numbers can't be changed - it's your account's permanent identity." });
});

router.post("/me/change-phone/confirm", async (_req, res) => {
  res.status(403).json({ error: "Mobile numbers can't be changed - it's your account's permanent identity." });
});

router.post("/me/delete-request", async (_req, res) => {
  res.status(403).json({ error: "Accounts can't be self-deleted. Contact support if you need help with your account." });
});

router.post("/me/cancel-deletion", async (_req, res) => {
  res.status(403).json({ error: "Accounts can't be self-deleted, so there's nothing to cancel." });
});

// ---- Dietary requirements (2.8) ----

router.put("/me/dietary", async (req, res) => {
  const requested: string[] = Array.isArray(req.body.types) ? req.body.types : [];
  const allergyDetail = typeof req.body.allergyDetail === "string" ? req.body.allergyDetail.trim().slice(0, 300) : null;
  // Silently drop anything that isn't a current option instead of rejecting
  // the whole save - the list has changed before (e.g. "Other" used to be
  // valid) and a stale value from an old save shouldn't block an unrelated
  // profile edit forever.
  const types = requested.filter((t) => DIETARY_OPTIONS.includes(t));

  await prisma.$transaction([
    prisma.userDietary.deleteMany({ where: { userId: req.userId } }),
    prisma.userDietary.createMany({
      data: types.map((type) => ({
        userId: req.userId!,
        type,
        detail: type === "Food Allergies" && allergyDetail ? allergyDetail : null,
      })),
    }),
  ]);

  res.json({ types, allergyDetail: types.includes("Food Allergies") ? allergyDetail : null });
});

// ---- Photos ----

router.post("/me/photos", async (req, res) => {
  const url = String(req.body.url ?? "").trim();
  if (!url) return res.status(400).json({ error: "Photo URL is required." });
  const count = await prisma.userPhoto.count({ where: { userId: req.userId } });
  const photo = await prisma.userPhoto.create({
    data: { userId: req.userId!, url, order: count },
  });
  res.status(201).json(photo);
});

router.delete("/me/photos/:id", async (req, res) => {
  await prisma.userPhoto.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});

// ---- Public profile (2.5 - never expose exact address; only approx distance) ----

router.get("/users/:id", async (req, res) => {
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { photos: true },
  });
  if (!target) return res.status(404).json({ error: "User not found." });

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: req.userId, blockedId: target.id },
        { blockerId: target.id, blockedId: req.userId },
      ],
    },
  });
  if (blocked) return res.status(404).json({ error: "User not found." });

  let approxDistanceMiles: number | null = null;
  const requester = await prisma.user.findUnique({ where: { id: req.userId } });
  if (requester?.locationLat != null && requester.locationLng != null && target.locationLat != null && target.locationLng != null) {
    approxDistanceMiles = haversineMiles(requester.locationLat, requester.locationLng, target.locationLat, target.locationLng);
  }

  const ratings = await computeRatingSummary(target.id);
  const socialReliability = await computeSocialReliability(target.id);

  res.json({
    id: target.id,
    firstName: target.firstName,
    age: target.age,
    gender: target.gender,
    isPro: target.subscriptionTier === "SUBSCRIBER",
    approxDistanceMiles: approxDistanceMiles != null ? Math.round(approxDistanceMiles * 10) / 10 : null,
    bio: target.bio,
    profilePhotoUrl: target.profilePhotoUrl,
    photos: target.photos.map((p) => ({ id: p.id, url: p.url })),
    overallRating: ratings.overallRating,
    workerRating: ratings.workerRating,
    hostRating: ratings.hostRating,
    completedCycles: ratings.completedCycles,
    completedTasksCount: await countCompletedTasks(target.id),
    // Social Reliability (11.13) - always shown separately from the star
    // rating above, never blended into it.
    socialReliability,
  });
});

// Any non-draft task belonging to this user, with safe (non-address) fields -
// used when a group leader is choosing which of a member's/invitee's tasks
// to view or invite them to join with.
router.get("/users/:id/tasks", async (req, res) => {
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: req.userId, blockedId: req.params.id },
        { blockerId: req.params.id, blockedId: req.userId },
      ],
    },
  });
  if (blocked) return res.status(404).json({ error: "User not found." });

  const tasks = await prisma.task.findMany({
    where: { ownerId: req.params.id, status: { not: "DRAFT" } },
    include: { category: true, photos: true, owner: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(
    tasks.map((task) => {
      const usingHome = task.locationType === "HOME";
      return {
        id: task.id,
        name: task.name,
        category: { id: task.category.id, name: task.category.name },
        description: task.description,
        jobLength: task.jobLength,
        locationLabel: usingHome ? task.owner.locationLabel : task.locationLabel,
        status: task.status,
        photos: task.photos.map((p) => ({ id: p.id, url: p.url })),
        ownerId: task.ownerId,
        ownerFirstName: task.owner.firstName,
      };
    })
  );
});

// ---- Blocking & reporting (2.9) ----

router.get("/me/blocked", async (req, res) => {
  const blocks = await prisma.block.findMany({
    where: { blockerId: req.userId },
    include: { blocked: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    blocks.map((b) => ({
      userId: b.blockedId,
      firstName: b.blocked.firstName,
      profilePhotoUrl: b.blocked.profilePhotoUrl,
      blockedAt: b.createdAt,
    }))
  );
});

router.post("/users/:id/block", async (req, res) => {
  if (req.params.id === req.userId) return res.status(400).json({ error: "You cannot block yourself." });
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: req.params.id } },
    create: { blockerId: req.userId!, blockedId: req.params.id },
    update: {},
  });
  res.json({ ok: true });
});

router.delete("/users/:id/block", async (req, res) => {
  await prisma.block.deleteMany({ where: { blockerId: req.userId, blockedId: req.params.id } });
  res.json({ ok: true });
});

router.post("/users/:id/report", async (req, res) => {
  const reason = String(req.body.reason ?? "").trim();
  if (!reason) return res.status(400).json({ error: "A reason is required to submit a report." });
  const report = await prisma.report.create({
    data: {
      reporterId: req.userId!,
      reportedUserId: req.params.id,
      reason,
      details: req.body.details ? String(req.body.details) : null,
    },
  });
  res.status(201).json({ id: report.id });
});

export default router;
