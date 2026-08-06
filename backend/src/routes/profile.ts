import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { computeRatingSummary } from "../services/ratings";
import { haversineMiles } from "../services/geo";
import { sendVerificationCode, isDevBypassCode } from "../services/sms";

const router = Router();
router.use(requireAuth);

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten Free", "Dairy Free", "Nut Allergy", "Other"];

function serializePrivateProfile(user: any, ratings: Awaited<ReturnType<typeof computeRatingSummary>>) {
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
    overallRating: ratings.overallRating,
    workerRating: ratings.workerRating,
    hostRating: ratings.hostRating,
    completedCycles: ratings.completedCycles,
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
  res.json(serializePrivateProfile(user, await computeRatingSummary(user.id)));
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

  res.json(serializePrivateProfile(updated, await computeRatingSummary(updated.id)));
});

// ---- Mobile number change (10.6) - never creates a new account or affects
// ratings, history or active groups; just updates the phone on this row. ----

const CODE_TTL_MINUTES = 10;

const changePhoneRequestSchema = z.object({ newPhone: z.string().min(6, "Enter a valid mobile number.") });

router.post("/me/change-phone/request", async (req, res) => {
  const parsed = changePhoneRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { newPhone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { phone: newPhone } });
  if (existing) return res.status(400).json({ error: "That number is already in use by another account." });

  const code = await sendVerificationCode(newPhone);
  await prisma.phoneVerification.create({
    data: { phone: newPhone, code, expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000) },
  });

  res.json({ ok: true });
});

const changePhoneConfirmSchema = z.object({ newPhone: z.string().min(6), code: z.string().min(4) });

router.post("/me/change-phone/confirm", async (req, res) => {
  const parsed = changePhoneConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { newPhone, code } = parsed.data;

  if (!isDevBypassCode(code)) {
    const verification = await prisma.phoneVerification.findFirst({
      where: { phone: newPhone, code, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!verification) return res.status(400).json({ error: "That code is incorrect or has expired." });
    await prisma.phoneVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } });
  }

  const existing = await prisma.user.findUnique({ where: { phone: newPhone } });
  if (existing) return res.status(400).json({ error: "That number is already in use by another account." });

  const updated = await prisma.user.update({ where: { id: req.userId }, data: { phone: newPhone } });
  res.json({ phone: updated.phone });
});

// ---- Account deletion (10.8) - deferred while the user has active group
// commitments; otherwise anonymised immediately. The row itself is kept so
// historical ratings and completed groups still reference a valid user. ----

async function activeCommitmentGroups(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, status: "ACTIVE", group: { state: { notIn: ["DISBANDED"] } } },
    include: { group: true },
  });
  const pendingApplications = await prisma.groupApplication.findMany({
    where: { applicantId: userId, status: "PENDING" },
    include: { group: true },
  });
  const names = new Set<string>();
  memberships.forEach((m) => names.add(m.group.name));
  pendingApplications.forEach((a) => names.add(a.group.name));
  return [...names];
}

router.post("/me/delete-request", async (req, res) => {
  const blocking = await activeCommitmentGroups(req.userId!);

  if (blocking.length > 0) {
    await prisma.user.update({ where: { id: req.userId }, data: { status: "PENDING_DELETION" } });
    return res.json({
      deferred: true,
      message: "Deletion is deferred until your active group commitments finish. Leave or complete them, then request deletion again.",
      blockingGroups: blocking,
    });
  }

  await prisma.$transaction([
    prisma.userSkill.deleteMany({ where: { userId: req.userId } }),
    prisma.userTool.deleteMany({ where: { userId: req.userId } }),
    prisma.userDietary.deleteMany({ where: { userId: req.userId } }),
    prisma.userPhoto.deleteMany({ where: { userId: req.userId } }),
    prisma.user.update({
      where: { id: req.userId },
      data: {
        phone: `deleted-${req.userId}`,
        firstName: null,
        age: null,
        gender: null,
        locationLabel: null,
        locationLat: null,
        locationLng: null,
        homeAddress: null,
        bio: null,
        profilePhotoUrl: null,
        status: "DELETED",
      },
    }),
  ]);

  res.json({ deferred: false, message: "Your account has been deleted." });
});

router.post("/me/cancel-deletion", async (req, res) => {
  await prisma.user.update({ where: { id: req.userId }, data: { status: "ACTIVE" } });
  res.json({ ok: true });
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

  const ratings = await computeRatingSummary(target.id);

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
    overallRating: ratings.overallRating,
    workerRating: ratings.workerRating,
    hostRating: ratings.hostRating,
    completedCycles: ratings.completedCycles,
  });
});


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
