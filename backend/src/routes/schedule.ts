import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { forfeitExpiredActiveTask, getCurrentCycle, parseOrder, requireActiveCycle } from "./groups";
import { notifyGroupMembers, notifyUser, postSystemMessage } from "../services/notify";

const router = Router();
router.use(requireAuth);

async function requireGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  return Boolean(member && member.status === "ACTIVE");
}

export const PROPOSAL_WINDOW_DAYS = 14;

function dayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Compared as whole calendar days (not exact timestamps) so the window the
// owner sees on the calendar and the window the server accepts always agree
// - no picking a date the UI allowed and then getting rejected on submit.
// Anchored to when the task became active, not "today".
function withinProposalWindow(date: Date, anchor: Date): boolean {
  const targetDay = dayString(date);
  const anchorDay = dayString(anchor);
  const maxDay = dayString(new Date(anchor.getTime() + PROPOSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  return targetDay >= anchorDay && targetDay <= maxDay;
}

// The task owner never needs to respond to their own proposal - "everyone"
// means every other active member.
async function requiredSubmitterIds(groupId: string, ownerId: string): Promise<string[]> {
  const members = await prisma.groupMember.findMany({ where: { groupId, status: "ACTIVE" } });
  return members.map((m) => m.userId).filter((id) => id !== ownerId);
}

async function allMembersSubmitted(proposalId: string, requiredIds: string[]): Promise<boolean> {
  if (requiredIds.length === 0) return true;
  const submissions = await prisma.proposalSubmission.findMany({ where: { proposalId, userId: { in: requiredIds } } });
  return requiredIds.every((id) => submissions.some((s) => s.userId === id));
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

  res.json(
    responses.map((r) => ({ userId: r.userId, firstName: r.user.firstName, profilePhotoUrl: r.user.profilePhotoUrl }))
  );
});

// 5.2/5.3/5.6 - the active task owner's scheduling workspace for their task.
router.get("/groups/:id/tasks/:taskId/schedule", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only group members can view scheduling for this task." });

  await forfeitExpiredActiveTask(req.params.id);

  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, groupId: req.params.id }, include: { owner: true } });
  if (!task) return res.status(404).json({ error: "Task not found in this group." });
  const isOwner = task.ownerId === req.userId;
  // 5.6 - HOME tasks resolve to the owner's current home address; CHOOSE tasks store their own.
  const exactAddress = task.locationType === "HOME" ? task.owner.homeAddress : task.exactAddress;

  const proposal = await prisma.availabilityProposal.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: "desc" },
    include: { options: { include: { responses: { include: { user: true } } } }, submissions: true },
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

  const requiredIds = proposal ? await requiredSubmitterIds(req.params.id, task.ownerId) : [];
  const allSubmitted = proposal ? await allMembersSubmitted(proposal.id, requiredIds) : false;
  const mySubmitted = proposal ? proposal.submissions.some((s) => s.userId === req.userId) : false;

  // The window the owner is allowed to pick dates in - anchored to when this
  // task became active, not "today" - so the calendar can grey out the rest
  // instead of letting the owner pick a date the server will then reject.
  const anchor = task.activatedAt ?? task.updatedAt;
  const windowStart = dayString(anchor);
  const windowEnd = dayString(new Date(anchor.getTime() + PROPOSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000));

  res.json({
    isOwner,
    windowStart,
    windowEnd,
    proposal: proposal
      ? {
          id: proposal.id,
          revisionUsed: proposal.revisionUsed,
          mySubmitted,
          allSubmitted,
          requiredSubmitterCount: requiredIds.length,
          submittedCount: proposal.submissions.filter((s) => requiredIds.includes(s.userId)).length,
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
    .max(PROPOSAL_WINDOW_DAYS),
});

// 5.3 - the active task owner proposes one or more possible dates, each
// within the next 2 weeks. This only creates the *first* round - once a
// proposal exists, later changes go through the one-time revision endpoint.
router.post("/groups/:id/tasks/:taskId/availability-proposals", async (req, res) => {
  const ctx = await requireActiveCycle(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  const order = parseOrder(ctx.cycle);
  if (order[0] !== req.params.taskId) return res.status(400).json({ error: "Only the active task owner can propose dates." });

  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ownerId: req.userId } });
  if (!task) return res.status(403).json({ error: "This isn't your task." });

  const existingWorkDay = await prisma.workDay.findUnique({ where: { taskId: task.id } });
  if (existingWorkDay) return res.status(400).json({ error: "A work date is already confirmed for this task." });

  const existingProposal = await prisma.availabilityProposal.findFirst({ where: { taskId: task.id } });
  if (existingProposal) return res.status(400).json({ error: "Dates have already been proposed - use a revision to add more." });

  const parsed = proposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const anchor = task.activatedAt ?? task.updatedAt;
  if (!parsed.data.options.every((o) => withinProposalWindow(new Date(o.date), anchor))) {
    return res.status(400).json({ error: "Dates can only be picked within 2 weeks of this task becoming active." });
  }

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

const reviseSchema = z.object({
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
    .max(PROPOSAL_WINDOW_DAYS),
});

// 5.3 - the task owner's single allowed revision: add more date/time options
// and send the whole thing back to the group for a fresh round of responses.
router.post("/groups/:id/tasks/:taskId/availability-revise", async (req, res) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, groupId: req.params.id, ownerId: req.userId } });
  if (!task) return res.status(403).json({ error: "This isn't your task." });

  const existingWorkDay = await prisma.workDay.findUnique({ where: { taskId: task.id } });
  if (existingWorkDay) return res.status(400).json({ error: "A work date is already confirmed for this task." });

  const proposal = await prisma.availabilityProposal.findFirst({ where: { taskId: task.id }, orderBy: { createdAt: "desc" } });
  if (!proposal) return res.status(400).json({ error: "Propose some dates first." });
  if (proposal.revisionUsed) return res.status(400).json({ error: "You've already used your one revision for this task." });

  const requiredIds = await requiredSubmitterIds(req.params.id, task.ownerId);
  if (!(await allMembersSubmitted(proposal.id, requiredIds))) {
    return res.status(400).json({ error: "Wait for everyone to submit their availability before revising." });
  }

  const parsed = reviseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const anchor = task.activatedAt ?? task.updatedAt;
  if (!parsed.data.options.every((o) => withinProposalWindow(new Date(o.date), anchor))) {
    return res.status(400).json({ error: "Dates can only be picked within 2 weeks of this task becoming active." });
  }

  await prisma.$transaction([
    prisma.dateOption.createMany({
      data: parsed.data.options.map((o) => ({
        proposalId: proposal.id,
        date: new Date(o.date),
        allDay: o.allDay,
        startTime: o.allDay ? null : o.startTime,
        endTime: o.allDay ? null : o.endTime,
      })),
    }),
    prisma.availabilityProposal.update({ where: { id: proposal.id }, data: { revisionUsed: true } }),
    prisma.proposalSubmission.deleteMany({ where: { proposalId: proposal.id } }),
  ]);

  await postSystemMessage(req.params.id, `${task.name}: the owner added more date options. Please resubmit your availability.`);
  await notifyGroupMembers(req.params.id, "DATES_REVISED", "Dates updated", `${task.name}: more date options were added. Resubmit your availability.`, {
    excludeUserId: req.userId,
  });

  res.json({ ok: true });
});

const respondSchema = z.object({ dateOptionId: z.string().min(1), available: z.boolean() });

// 5.4 - a member toggles availability on one of the owner's proposed dates.
// Only allowed while they haven't submitted their round yet - after that
// it's locked, not endlessly editable.
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

  const alreadySubmitted = await prisma.proposalSubmission.findUnique({
    where: { proposalId_userId: { proposalId: option.proposalId, userId: req.userId! } },
  });
  if (alreadySubmitted) return res.status(400).json({ error: "You've already submitted your availability for this round." });

  await prisma.availabilityResponse.upsert({
    where: { dateOptionId_userId: { dateOptionId: option.id, userId: req.userId! } },
    create: { dateOptionId: option.id, userId: req.userId!, available: parsed.data.available },
    update: { available: parsed.data.available },
  });

  res.json({ ok: true });
});

// 5.4 - locks in the member's responses for this round and, once everyone
// required has done the same, lets the task owner know it's their turn.
router.post("/groups/:id/tasks/:taskId/availability-submit", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only group members can submit availability." });

  const task = await prisma.task.findFirst({ where: { id: req.params.taskId, groupId: req.params.id } });
  if (!task) return res.status(404).json({ error: "Task not found in this group." });
  if (task.ownerId === req.userId) return res.status(400).json({ error: "The task owner doesn't submit availability." });

  const proposal = await prisma.availabilityProposal.findFirst({ where: { taskId: task.id }, orderBy: { createdAt: "desc" } });
  if (!proposal) return res.status(400).json({ error: "No dates have been proposed yet." });

  const alreadyConfirmed = await prisma.workDay.findUnique({ where: { taskId: task.id } });
  if (alreadyConfirmed) return res.status(400).json({ error: "This work date is already confirmed." });

  await prisma.proposalSubmission.upsert({
    where: { proposalId_userId: { proposalId: proposal.id, userId: req.userId! } },
    create: { proposalId: proposal.id, userId: req.userId! },
    update: {},
  });

  const requiredIds = await requiredSubmitterIds(req.params.id, task.ownerId);
  const allSubmitted = await allMembersSubmitted(proposal.id, requiredIds);
  if (allSubmitted) {
    await notifyUser(
      task.ownerId,
      "AVAILABILITY_READY",
      "Everyone's responded",
      `Everyone's submitted their availability for ${task.name}. Pick a date or revise the options.`,
      { groupId: req.params.id, taskId: task.id }
    );
  }

  res.json({ ok: true, allSubmitted });
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

  const requiredIds = await requiredSubmitterIds(req.params.id, task.ownerId);
  if (!(await allMembersSubmitted(option.proposalId, requiredIds))) {
    return res.status(400).json({ error: "Wait for everyone to submit their availability before confirming a date." });
  }

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
