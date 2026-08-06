import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten Free", "Dairy Free", "Nut Allergy", "Other"];

function serializePrivateProfile(user: any) {
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
    skills: user.skills?.map((s: any) => ({ id: s.id, label: s.label })) ?? [],
    tools: user.tools?.map((t: any) => ({ id: t.id, label: t.label })) ?? [],
    dietary: user.dietary?.map((d: any) => d.type) ?? [],
    photos: user.photos?.map((p: any) => ({ id: p.id, url: p.url })) ?? [],
    // Rating aggregates arrive with Milestone 5; new accounts show as unrated.
    overallRating: null,
    workerRating: null,
    hostRating: null,
    completedCycles: 0,
  };
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
    include: { skills: true, tools: true, dietary: true, photos: true },
  });
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json(serializePrivateProfile(user));
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  age: z.number().int().min(16).max(120).optional(),
  gender: z.string().min(1).max(50).optional(),
  locationLabel: z.string().min(1).max(120).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  homeAddress: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  profilePhotoUrl: z.string().url().optional(),
});

// 2.3/2.4/2.11 - users may edit their profile at any time.
router.put("/me", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const merged = { ...existing, ...parsed.data };

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...parsed.data,
      profileComplete: isProfileComplete(merged),
    },
    include: { skills: true, tools: true, dietary: true, photos: true },
  });

  res.json(serializePrivateProfile(updated));
});

// ---- Skills (2.6) ----

router.post("/me/skills", async (req, res) => {
  const label = String(req.body.label ?? "").trim();
  if (!label) return res.status(400).json({ error: "Skill cannot be empty." });
  const skill = await prisma.userSkill.create({ data: { userId: req.userId!, label } });
  res.status(201).json(skill);
});

router.delete("/me/skills/:id", async (req, res) => {
  await prisma.userSkill.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});

// ---- Tools (2.7) ----

router.post("/me/tools", async (req, res) => {
  const label = String(req.body.label ?? "").trim();
  if (!label) return res.status(400).json({ error: "Tool cannot be empty." });
  const tool = await prisma.userTool.create({ data: { userId: req.userId!, label } });
  res.status(201).json(tool);
});

router.delete("/me/tools/:id", async (req, res) => {
  await prisma.userTool.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});

// ---- Dietary requirements (2.8) ----

router.put("/me/dietary", async (req, res) => {
  const types: string[] = Array.isArray(req.body.types) ? req.body.types : [];
  const invalid = types.filter((t) => !DIETARY_OPTIONS.includes(t));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Unknown dietary option(s): ${invalid.join(", ")}` });
  }

  await prisma.$transaction([
    prisma.userDietary.deleteMany({ where: { userId: req.userId } }),
    prisma.userDietary.createMany({
      data: types.map((type) => ({ userId: req.userId!, type })),
    }),
  ]);

  res.json({ types });
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
    include: { skills: true, tools: true, photos: true },
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

  res.json({
    id: target.id,
    firstName: target.firstName,
    age: target.age,
    gender: target.gender,
    approxDistanceMiles: approxDistanceMiles != null ? Math.round(approxDistanceMiles * 10) / 10 : null,
    bio: target.bio,
    profilePhotoUrl: target.profilePhotoUrl,
    photos: target.photos.map((p) => ({ id: p.id, url: p.url })),
    skills: target.skills.map((s) => s.label),
    tools: target.tools.map((t) => t.label),
    overallRating: null,
    workerRating: null,
    hostRating: null,
    completedCycles: 0,
  });
});

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---- Blocking & reporting (2.9) ----

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
