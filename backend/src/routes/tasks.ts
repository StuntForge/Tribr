import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const FREE_TASK_LIMIT = 1;
const SUBSCRIBER_TASK_LIMIT = 20;

// Tasks that don't count against a user's active-task limit (3.2, 3.7).
// Drafts aren't yet "maintained" in the sense 3.2 means, and archived tasks are done with.
const NON_COUNTING_STATUSES = ["ARCHIVED", "DRAFT"];

function taskLimitFor(subscriptionTier: string) {
  return subscriptionTier === "SUBSCRIBER" ? SUBSCRIBER_TASK_LIMIT : FREE_TASK_LIMIT;
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
    estimatedManHours: task.estimatedManHours,
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

// 3.6 - a task is editable/deletable only while it hasn't been committed to a working cycle.
function isLocked(task: { groupId: string | null; group: { state: string } | null }) {
  return Boolean(task.groupId && task.group && task.group.state === "WORKING");
}

router.get("/job-categories", async (_req, res) => {
  const categories = await prisma.jobCategory.findMany({
    where: { active: true },
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
  estimatedManHours: z.number().positive().max(1000),
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
  const { name, categoryId, description, estimatedManHours, location, notes, isDraft } = parsed.data;

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
      estimatedManHours,
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
  estimatedManHours: z.number().positive().max(1000).optional(),
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
  if (isLocked(existing)) {
    return res.status(400).json({ error: "This task is locked while its group is working through the current cycle." });
  }

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { location, ...rest } = parsed.data;

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

router.post("/tasks/:id/photos", async (req, res) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
  if (!task) return res.status(404).json({ error: "Task not found." });
  const url = String(req.body.url ?? "").trim();
  if (!url) return res.status(400).json({ error: "Photo URL is required." });
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
