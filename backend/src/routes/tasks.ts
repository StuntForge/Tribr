import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { findProfanity } from "../services/profanity";

const router = Router();
router.use(requireAuth);

// Tribr doesn't support jobs longer than a day, so the estimate is a coarse
// band rather than an open-ended hours figure - simpler for the person
// setting it, and directly usable as a compatibility check against a
// group's maximum job length.
export const JOB_LENGTHS = ["FEW_HOURS", "HALF_DAY", "FULL_DAY"] as const;
const jobLengthSchema = z.enum(JOB_LENGTHS);
export const JOB_LENGTH_RANK: Record<string, number> = { FEW_HOURS: 0, HALF_DAY: 1, FULL_DAY: 2 };

const FREE_TASK_LIMIT = 1;
const SUBSCRIBER_TASK_LIMIT = 20;

// Tasks that don't count against a user's active-task limit (3.2, 3.7).
// Drafts aren't yet "maintained" in the sense 3.2 means, ARCHIVED tasks are
// completed and done with, and USER_ARCHIVED tasks were deliberately shelved
// by the owner.
const NON_COUNTING_STATUSES = ["ARCHIVED", "DRAFT", "USER_ARCHIVED"];

function taskLimitFor(subscriptionTier: string) {
  return subscriptionTier === "SUBSCRIBER" ? SUBSCRIBER_TASK_LIMIT : FREE_TASK_LIMIT;
}

// Called after a user's subscription lands on FREE (downgrade or renewal
// lapse). A Pro user can be well over the free task limit; rather than
// leaving those tasks live and just blocking new ones, bring them back down
// to the free shape immediately: keep one available task if none of their
// tasks are currently assigned to a group, otherwise archive all available
// tasks (their in-progress group tasks are never touched - they just can't
// add more availability until those finish).
export async function enforceFreeTaskLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.subscriptionTier === "SUBSCRIBER") return;

  const assignedCount = await prisma.task.count({
    where: { ownerId: userId, status: { in: ["SUBMITTED", "APPROVED", "ACTIVE"] } },
  });
  const availableTasks = await prisma.task.findMany({
    where: { ownerId: userId, status: "AVAILABLE" },
    orderBy: { createdAt: "asc" },
  });
  if (availableTasks.length === 0) return;

  const keepCount = assignedCount > 0 ? 0 : 1;
  const toArchive = availableTasks.slice(keepCount);
  if (toArchive.length > 0) {
    await prisma.task.updateMany({ where: { id: { in: toArchive.map((t) => t.id) } }, data: { status: "USER_ARCHIVED" } });
  }
}

async function serializeTask(
  task: any,
  owner: { locationLabel: string | null; locationLat: number | null; locationLng: number | null; homeAddress: string | null }
) {
  const usingHome = task.locationType === "HOME";
  return {
    id: task.id,
    name: task.name,
    category: { id: task.category.id, name: task.category.name },
    description: task.description,
    jobLength: task.jobLength,
    locationType: task.locationType,
    locationLabel: usingHome ? owner.locationLabel : task.locationLabel,
    locationLat: usingHome ? owner.locationLat : task.locationLat,
    locationLng: usingHome ? owner.locationLng : task.locationLng,
    // Exact address - visible here because this is always the owner's own view of their own task.
    exactAddress: usingHome ? owner.homeAddress : task.exactAddress,
    notes: task.notes,
    status: task.status,
    groupId: task.groupId,
    photos: task.photos?.map((p: any) => ({ id: p.id, url: p.url })) ?? [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

// 3.6 - a task is editable only while it's genuinely free (AVAILABLE/DRAFT).
// Previously this only locked once the group started WORKING, which left a
// window open the whole time a task sat SUBMITTED or APPROVED to a group
// still recruiting - editable right up until the cycle kicked off.
function isLocked(task: { status: string }) {
  return ["SUBMITTED", "APPROVED", "ACTIVE"].includes(task.status);
}

// 11.x - defaults to WORK categories for backward compatibility with the
// existing (pre-Social-Tribes) Work Tribe task/category pickers, which call
// this unfiltered.
router.get("/job-categories", async (req, res) => {
  const kind = req.query.kind === "SOCIAL" ? "SOCIAL" : "WORK";
  const categories = await prisma.jobCategory.findMany({
    where: { active: true, kind },
    orderBy: { name: "asc" },
  });
  res.json(categories);
});

router.get("/tasks", async (req, res) => {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const tasks = await prisma.task.findMany({
    where: { ownerId: req.userId },
    include: { category: true, photos: true, group: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(await Promise.all(tasks.map((t) => serializeTask(t, owner))));
});

router.get("/tasks/:id", async (req, res) => {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
    include: { category: true, photos: true, group: true },
  });
  if (!task) return res.status(404).json({ error: "Task not found." });
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  res.json(await serializeTask(task, owner));
});

// Public-safe view of any task (not just your own) - used when a group leader
// is reviewing a member's/invitee's tasks, or viewing a fellow group member's
// task. Never exposes the exact address, only the approximate label.
router.get("/tasks/:id/public", async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { category: true, photos: true, owner: true, group: true },
  });
  if (!task) return res.status(404).json({ error: "Task not found." });

  const usingHome = task.locationType === "HOME";
  res.json({
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
    groupId: task.groupId,
    groupName: task.group?.name ?? null,
  });
});

// Lets the owner back out of a task they've submitted to a Tribe (still
// awaiting a decision) without having to wait on the leader to reject it -
// mirrors /groups/:id/applications/:appId/withdraw but reachable from the
// task's own detail screen, which only has the taskId to hand.
router.post("/tasks/:id/withdraw-application", async (req, res) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.id, ownerId: req.userId, status: "SUBMITTED" } });
  if (!task) return res.status(400).json({ error: "This task isn't currently submitted to a Tribe." });

  const application = await prisma.groupApplication.findFirst({
    where: { taskId: task.id, applicantId: req.userId, status: { in: ["PENDING", "TASK_REQUESTED", "TASK_SUGGESTED"] } },
    orderBy: { createdAt: "desc" },
  });
  // A SUBMITTED task with no matching open application is an inconsistent
  // state that shouldn't happen, but has been observed - always let the
  // owner free their own task rather than leaving them permanently stuck,
  // even if there's nothing to mark WITHDRAWN on the application side.
  if (!application) {
    console.error(`Task ${task.id} was SUBMITTED with no open application for user ${req.userId} - releasing anyway.`);
  }

  await prisma.$transaction([
    prisma.task.update({ where: { id: task.id }, data: { status: "AVAILABLE", groupId: null, cycleId: null } }),
    ...(application ? [prisma.groupApplication.update({ where: { id: application.id }, data: { status: "WITHDRAWN" } })] : []),
  ]);

  res.json({ ok: true });
});

const locationSchema = z.union([
  z.object({ type: z.literal("HOME") }),
  z.object({
    type: z.literal("CHOOSE"),
    label: z.string().min(1),
    lat: z.number().optional(),
    lng: z.number().optional(),
    // Full street address - kept separate from the public-facing approximate label (3.5, 5.6).
    exactAddress: z.string().max(200).optional(),
  }),
]);

const createTaskSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: z.string().min(1),
  description: z.string().min(1).max(2000),
  jobLength: jobLengthSchema,
  location: locationSchema,
  notes: z.string().max(1000).optional(),
  isDraft: z.boolean().optional(),
});

// 3.2 - create a task from the user's personal library.
router.post("/tasks", async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, categoryId, description, jobLength, location, notes, isDraft } = parsed.data;

  const badWords = findProfanity(name, description, notes);
  if (badWords.length > 0) {
    return res.status(400).json({ error: `Please remove this language before submitting: ${badWords.join(", ")}` });
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const category = await prisma.jobCategory.findUnique({ where: { id: categoryId } });
  if (!category) return res.status(400).json({ error: "Unknown job category." });

  if (!isDraft) {
    const activeCount = await prisma.task.count({
      where: { ownerId: req.userId, status: { notIn: NON_COUNTING_STATUSES } },
    });
    const limit = taskLimitFor(owner.subscriptionTier);
    if (activeCount >= limit) {
      return res.status(403).json({
        error:
          owner.subscriptionTier === "SUBSCRIBER"
            ? `Subscribers can maintain up to ${limit} active tasks. Archive or complete one first.`
            : `Free members can maintain 1 active task. Subscribe to add more, or save this as a draft.`,
      });
    }
  }

  const task = await prisma.task.create({
    data: {
      ownerId: req.userId!,
      name,
      categoryId,
      description,
      jobLength,
      estimatedManHours: 0,
      locationType: location.type,
      locationLabel: location.type === "CHOOSE" ? location.label : null,
      locationLat: location.type === "CHOOSE" ? location.lat : null,
      locationLng: location.type === "CHOOSE" ? location.lng : null,
      exactAddress: location.type === "CHOOSE" ? location.exactAddress ?? null : null,
      notes,
      status: isDraft ? "DRAFT" : "AVAILABLE",
    },
    include: { category: true, photos: true, group: true },
  });

  res.status(201).json(await serializeTask(task, owner));
});

const updateTaskSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  categoryId: z.string().min(1).optional(),
  description: z.string().min(1).max(2000).optional(),
  jobLength: jobLengthSchema.optional(),
  location: locationSchema.optional(),
  notes: z.string().max(1000).optional(),
});

router.put("/tasks/:id", async (req, res) => {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
    include: { group: true },
  });
  if (!existing) return res.status(404).json({ error: "Task not found." });
  if (existing.status === "ARCHIVED" || existing.status === "COMPLETED") {
    return res.status(400).json({ error: "Completed tasks can't be edited." });
  }
  if (existing.status === "USER_ARCHIVED") {
    return res.status(400).json({ error: "Activate this task before editing it." });
  }
  if (isLocked(existing)) {
    return res.status(400).json({ error: "This task is locked while its group is working through the current cycle." });
  }

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { location, ...rest } = parsed.data;

  const badWords = findProfanity(rest.name, rest.description, rest.notes);
  if (badWords.length > 0) {
    return res.status(400).json({ error: `Please remove this language before submitting: ${badWords.join(", ")}` });
  }

  if (rest.categoryId) {
    const category = await prisma.jobCategory.findUnique({ where: { id: rest.categoryId } });
    if (!category) return res.status(400).json({ error: "Unknown job category." });
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(location
        ? {
            locationType: location.type,
            locationLabel: location.type === "CHOOSE" ? location.label : null,
            locationLat: location.type === "CHOOSE" ? location.lat : null,
            locationLng: location.type === "CHOOSE" ? location.lng : null,
            exactAddress: location.type === "CHOOSE" ? location.exactAddress ?? null : null,
          }
        : {}),
    },
    include: { category: true, photos: true, group: true },
  });

  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  res.json(await serializeTask(task, owner));
});

// Draft -> Available (3.7). Only meaningful transition a user drives directly in M2;
// later transitions (Submitted/Approved/Active/Completed) are driven by group workflows.
router.post("/tasks/:id/publish", async (req, res) => {
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Task not found." });
  if (existing.status !== "DRAFT") {
    return res.status(400).json({ error: "Only draft tasks can be published." });
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const activeCount = await prisma.task.count({
    where: { ownerId: req.userId, status: { notIn: NON_COUNTING_STATUSES } },
  });
  const limit = taskLimitFor(owner.subscriptionTier);
  if (activeCount >= limit) {
    return res.status(403).json({ error: `You're at your active task limit (${limit}).` });
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { status: "AVAILABLE" },
    include: { category: true, photos: true, group: true },
  });
  res.json(await serializeTask(task, owner));
});

// User shelves an available task - keeps the history/description around
// without it counting toward their active task limit.
router.post("/tasks/:id/archive", async (req, res) => {
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Task not found." });
  if (existing.status !== "AVAILABLE") {
    return res.status(400).json({ error: "Only an available task can be archived." });
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { status: "USER_ARCHIVED" },
    include: { category: true, photos: true, group: true },
  });
  res.json(await serializeTask(task, owner));
});

router.post("/tasks/:id/activate", async (req, res) => {
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Task not found." });
  if (existing.status !== "USER_ARCHIVED") {
    return res.status(400).json({ error: "Only an archived task can be activated." });
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const activeCount = await prisma.task.count({
    where: { ownerId: req.userId, status: { notIn: NON_COUNTING_STATUSES } },
  });
  const limit = taskLimitFor(owner.subscriptionTier);
  if (activeCount >= limit) {
    return res.status(403).json({ error: `You're at your active task limit (${limit}). Archive or complete one first.` });
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { status: "AVAILABLE" },
    include: { category: true, photos: true, group: true },
  });
  res.json(await serializeTask(task, owner));
});

router.delete("/tasks/:id", async (req, res) => {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
    include: { group: true },
  });
  if (!existing) return res.status(404).json({ error: "Task not found." });
  if (existing.groupId) {
    return res.status(400).json({ error: "This task is part of a group and can't be deleted." });
  }

  await prisma.task.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

const MAX_TASK_PHOTOS = 4;

router.post("/tasks/:id/photos", async (req, res) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
  if (!task) return res.status(404).json({ error: "Task not found." });
  const url = String(req.body.url ?? "").trim();
  if (!url) return res.status(400).json({ error: "Photo URL is required." });
  const count = await prisma.taskPhoto.count({ where: { taskId: task.id } });
  if (count >= MAX_TASK_PHOTOS) {
    return res.status(400).json({ error: `You can add up to ${MAX_TASK_PHOTOS} photos per task.` });
  }
  const photo = await prisma.taskPhoto.create({ data: { taskId: task.id, url } });
  res.status(201).json(photo);
});

router.delete("/tasks/:taskId/photos/:photoId", async (req, res) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ownerId: req.userId } });
  if (!task) return res.status(404).json({ error: "Task not found." });
  await prisma.taskPhoto.deleteMany({ where: { id: req.params.photoId, taskId: task.id } });
  res.json({ ok: true });
});

export default router;
