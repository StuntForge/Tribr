import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { getCurrentCycle, parseOrder, requireActiveCycle } from "./groups";
import { notifyGroupMembers, notifyUser, postSystemMessage } from "../services/notify";

const router = Router();
router.use(requireAuth);

async function requireGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  return Boolean(member && member.status === "ACTIVE");
}

// 9.3 - Home screen data: active commitments prioritised over discovery.
router.get("/me/home-summary", async (req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId, status: "ACTIVE", group: { state: { notIn: ["DISBANDED"] } } },
    include: { group: true },
  });

  const activeGroups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    state: m.group.state,
    isLeader: m.isLeader,
    cycleNumber: m.group.currentCycleNumber,
  }));

  const pendingApplicationsToReview = await prisma.groupApplication.count({
    where: { status: "PENDING", group: { leaderId: req.userId, id: { in: memberships.map((m) => m.groupId) } } },
  });

  const groupIds = memberships.map((m) => m.groupId);
  const workDays = await prisma.workDay.findMany({
    where: { task: { groupId: { in: groupIds } }, confirmedDate: { gte: new Date() } },
    include: { task: { include: { group: true } } },
    orderBy: { confirmedDate: "asc" },
  });

  const upcoming = [];
  for (const wd of workDays) {
    const isOwner = wd.task.ownerId === req.userId;
    const available = await prisma.availabilityResponse.findFirst({
      where: { userId: req.userId, available: true, dateOption: { proposal: { taskId: wd.taskId }, date: wd.confirmedDate } },
    });
    if (!isOwner && !available) continue;
    upcoming.push({
      groupId: wd.task.groupId,
      groupName: wd.task.group?.name ?? "",
      taskId: wd.taskId,
      taskName: wd.task.name,
      confirmedDate: wd.confirmedDate,
      allDay: wd.allDay,
      startTime: wd.startTime,
      endTime: wd.endTime,
    });
  }

  res.json({ activeGroups, pendingApplicationsToReview, upcomingWorkDays: upcoming });
});

// 6.3 - who the task owner needs to rate: members who confirmed availability
// for the confirmed date, excluding the owner themselves.
router.get("/groups/:id/tasks/:taskId/attendees", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only group members can view this." });

  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, groupId: req.params.id } });
  if (!task) return res.status(404).json({ error: "Task not found in this group." });

  const workDay = await prisma.workDay.findUnique({ where: { taskId: task.id } });
  if (!workDay) return res.json([]);

  const responses = await prisma.availabilityResponse.findMany({
    where: { available: true, dateOption: { proposal: { taskId: task.id }, date: workDay.confirmedDate }, userId: { not: task.ownerId } },
    include: { user: true },
  });

  res.json(responses.map((r) => ({ userId: r.userId, firstName: r.user.firstName })));
});

// 5.2/5.3/5.6 - the active task owner's scheduling workspace for their task.
router.get("/groups/:id/tasks/:taskId/schedule", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only group members can view scheduling for this task." });

  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, groupId: req.params.id }, include: { owner: true } });
  if (!task) return res.status(404).json({ error: "Task not found in this group." });
  const isOwner = task.ownerId === req.userId;
  // 5.6 - HOME tasks resolve to the owner's current home address; CHOOSE tasks store their own.
  const exactAddress = task.locationType === "HOME" ? task.owner.homeAddress : task.exactAddress;

  const proposal = await prisma.availabilityProposal.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: "desc" },
    include: { options: { include: { responses: { include: { user: true } } } } },
  });

  const workDay = await prisma.workDay.findUnique({ where: { taskId: task.id } });

  let dietaryByOption: Record<string, string[]> | undefined;
  if (isOwner && proposal) {
    dietaryByOption = {};
    for (const option of proposal.options) {
      const availableUserIds = option.responses.filter((r) => r.available).map((r) => r.userId);
      const dietary = await prisma.userDietary.findMany({ where: { userId: { in: availableUserIds } } });
      dietaryByOption[option.id] = [...new Set(dietary.map((d) => d.type))];
    }
  }

  res.json({
    isOwner,
    proposal: proposal
      ? {
          id: proposal.id,
          options: proposal.options.map((o) => ({
            id: o.id,
            date: o.date,
            allDay: o.allDay,
            startTime: o.startTime,
            endTime: o.endTime,
            myResponse: o.responses.find((r) => r.userId === req.userId)?.available ?? null,
            availableCount: o.responses.filter((r) => r.available).length,
            unavailableCount: o.responses.filter((r) => !r.available).length,
            availableMembers: o.responses.filter((r) => r.available).map((r) => r.user.firstName),
            dietary: dietaryByOption?.[o.id],
          })),
        }
      : null,
    workDay: workDay
      ? {
          confirmedDate: workDay.confirmedDate,
          allDay: workDay.allDay,
          startTime: workDay.startTime,
          endTime: workDay.endTime,
          foodProvided: workDay.foodProvided,
          // 5.6 - exact address only ever reaches confirmed group members.
          address: exactAddress,
        }
      : null,
  });
});

const proposeSchema = z.object({
  options: z
    .array(
      z.object({
        date: z.string(),
        allDay: z.boolean().default(true),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      })
    )
    .min(1)
    .max(5),
});

// 5.3 - the active task owner proposes one or more possible dates.
router.post("/groups/:id/tasks/:taskId/availability-proposals", async (req, res) => {
  const ctx = await requireActiveCycle(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  const order = parseOrder(ctx.cycle);
  if (order[0] !== req.params.taskId) return res.status(400).json({ error: "Only the active task owner can propose dates." });

  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ownerId: req.userId } });
  if (!task) return res.status(403).json({ error: "This isn't your task." });

  const existingWorkDay = await prisma.workDay.findUnique({ where: { taskId: task.id } });
  if (existingWorkDay) return res.status(400).json({ error: "A work date is already confirmed for this task." });

  const parsed = proposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const proposal = await prisma.availabilityProposal.create({
    data: {
      taskId: task.id,
      options: {
        create: parsed.data.options.map((o) => ({
          date: new Date(o.date),
          allDay: o.allDay,
          startTime: o.allDay ? null : o.startTime,
          endTime: o.allDay ? null : o.endTime,
        })),
      },
    },
    include: { options: true },
  });

  await postSystemMessage(req.params.id, `${task.name}: new work dates proposed. Let the group know your availability.`);
  await notifyGroupMembers(req.params.id, "DATES_PROPOSED", "New dates proposed", `New possible work dates for ${task.name}.`, {
    excludeUserId: req.userId,
  });

  res.status(201).json({ id: proposal.id, options: proposal.options });
});

const respondSchema = z.object({ dateOptionId: z.string().min(1), available: z.boolean() });

// 5.4 - every member responds to each proposed date individually.
router.post("/groups/:id/tasks/:taskId/availability-responses", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only group members can respond." });

  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const option = await prisma.dateOption.findFirst({
    where: { id: parsed.data.dateOptionId, proposal: { taskId: req.params.taskId } },
  });
  if (!option) return res.status(404).json({ error: "Date option not found." });

  const alreadyConfirmed = await prisma.workDay.findUnique({ where: { taskId: req.params.taskId } });
  if (alreadyConfirmed) return res.status(400).json({ error: "This work date is already confirmed." });

  await prisma.availabilityResponse.upsert({
    where: { dateOptionId_userId: { dateOptionId: option.id, userId: req.userId! } },
    create: { dateOptionId: option.id, userId: req.userId!, available: parsed.data.available },
    update: { available: parsed.data.available },
  });

  res.json({ ok: true });
});

const confirmSchema = z.object({ dateOptionId: z.string().min(1), foodProvided: z.boolean() });

// 5.5/5.6/5.7 - task owner confirms one date; address reveals, food plan set.
router.post("/groups/:id/tasks/:taskId/confirm", async (req, res) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, groupId: req.params.id, ownerId: req.userId } });
  if (!task) return res.status(403).json({ error: "This isn't your task." });

  const existing = await prisma.workDay.findUnique({ where: { taskId: task.id } });
  if (existing) return res.status(400).json({ error: "A work date is already confirmed for this task." });

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const option = await prisma.dateOption.findFirst({
    where: { id: parsed.data.dateOptionId, proposal: { taskId: task.id } },
  });
  if (!option) return res.status(404).json({ error: "Date option not found." });

  await prisma.workDay.create({
    data: {
      taskId: task.id,
      confirmedDate: option.date,
      allDay: option.allDay,
      startTime: option.startTime,
      endTime: option.endTime,
      foodProvided: parsed.data.foodProvided,
    },
  });

  const availableResponses = await prisma.availabilityResponse.findMany({ where: { dateOptionId: option.id, available: true } });
  const dateLabel = option.allDay ? new Date(option.date).toDateString() : `${new Date(option.date).toDateString()} ${option.startTime}-${option.endTime}`;

  await postSystemMessage(req.params.id, `${task.name}: work day confirmed for ${dateLabel}.`);
  await notifyGroupMembers(req.params.id, "WORK_DAY_CONFIRMED", "Work day confirmed", `${task.name} is happening on ${dateLabel}.`, {
    onlyUserIds: availableResponses.map((r) => r.userId),
  });

  res.json({ ok: true });
});

export default router;
