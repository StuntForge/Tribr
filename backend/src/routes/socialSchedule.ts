import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { notifyGroupMembers, notifyUser, postSystemMessage } from "../services/notify";
import { PROPOSAL_WINDOW_DAYS, dayString, withinProposalWindow } from "../services/scheduleWindow";

// 11.x - Social Tribes "Schedule Together" scheduling. A deliberate mirror
// of schedule.ts's propose/respond/submit/confirm flow, but keyed by
// groupId only (a Social Tribe has one shared activity for the whole
// group, not a per-member task/queue) - kept as a separate set of
// models/routes rather than bolting a nullable groupId onto the Work
// scheduling tables, to avoid touching that already-hardened code path.

const router = Router();
router.use(requireAuth);

async function requireGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  return Boolean(member && member.status === "ACTIVE");
}

// The leader proposes/confirms dates, so (mirroring Work's task-owner
// exclusion) they don't submit their own availability - "everyone" means
// every other active member.
async function requiredSubmitterIds(groupId: string, leaderId: string): Promise<string[]> {
  const members = await prisma.groupMember.findMany({ where: { groupId, status: "ACTIVE" } });
  return members.map((m) => m.userId).filter((id) => id !== leaderId);
}

async function allMembersSubmitted(proposalId: string, requiredIds: string[]): Promise<boolean> {
  if (requiredIds.length === 0) return true;
  const submissions = await prisma.socialProposalSubmission.findMany({ where: { proposalId, userId: { in: requiredIds } } });
  return requiredIds.every((id) => submissions.some((s) => s.userId === id));
}

async function requireSocialWorkingGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.tribeType !== "SOCIAL") return { error: "Not a Social Tribe." as const };
  if (group.state !== "WORKING") return { error: "This Tribe hasn't started yet." as const };
  if (group.dateType !== "SCHEDULE_TOGETHER") return { error: "This Tribe's date is fixed - there's nothing to schedule." as const };
  return { group };
}

// The leader's/member's scheduling workspace for a Schedule Together Tribe.
router.get("/groups/:id/social/schedule", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only Tribe members can view scheduling for this Tribe." });

  const group = await prisma.group.findFirst({ where: { id: req.params.id, tribeType: "SOCIAL" } });
  if (!group) return res.status(404).json({ error: "Social Tribe not found." });
  const isLeader = group.leaderId === req.userId;

  const proposal = await prisma.socialEventProposal.findUnique({
    where: { groupId: group.id },
    include: { options: { include: { responses: { include: { user: true } } } }, submissions: true },
  });

  const socialEvent = await prisma.socialEvent.findUnique({ where: { groupId: group.id } });

  const requiredIds = proposal ? await requiredSubmitterIds(group.id, group.leaderId) : [];
  const allSubmitted = proposal ? await allMembersSubmitted(proposal.id, requiredIds) : false;
  const mySubmitted = proposal ? proposal.submissions.some((s) => s.userId === req.userId) : false;

  // The window the leader is allowed to pick dates in, anchored to when the
  // Tribe started - same role task.activatedAt plays for Work scheduling.
  const anchor = group.socialScheduleWindowStart ?? group.updatedAt;
  const windowStart = dayString(anchor);
  const windowEnd = dayString(new Date(anchor.getTime() + PROPOSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000));

  res.json({
    isLeader,
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
          })),
        }
      : null,
    socialEvent: socialEvent
      ? { confirmedDate: socialEvent.confirmedDate, allDay: socialEvent.allDay, startTime: socialEvent.startTime, endTime: socialEvent.endTime }
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

// The leader proposes one or more possible dates/times, each within the
// 2-week window that opened when the Tribe started. Only creates the
// *first* round - later changes go through the one-time revision endpoint.
router.post("/groups/:id/social/propose-dates", async (req, res) => {
  const ctx = await requireSocialWorkingGroup(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  if (ctx.group.leaderId !== req.userId) return res.status(403).json({ error: "Only the Tribe leader can propose dates." });

  const existingEvent = await prisma.socialEvent.findUnique({ where: { groupId: ctx.group.id } });
  if (existingEvent) return res.status(400).json({ error: "A date is already confirmed for this Tribe." });

  const existingProposal = await prisma.socialEventProposal.findUnique({ where: { groupId: ctx.group.id } });
  if (existingProposal) return res.status(400).json({ error: "Dates have already been proposed - use a revision to add more." });

  const parsed = proposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const anchor = ctx.group.socialScheduleWindowStart ?? ctx.group.updatedAt;
  if (!parsed.data.options.every((o) => withinProposalWindow(new Date(o.date), anchor))) {
    return res.status(400).json({ error: "Dates can only be picked within 2 weeks of this Tribe starting." });
  }

  const proposal = await prisma.socialEventProposal.create({
    data: {
      groupId: ctx.group.id,
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

  await postSystemMessage(ctx.group.id, "New dates proposed. Let the Tribe know your availability.");
  await notifyGroupMembers(ctx.group.id, "SOCIAL_SCHEDULING_OPENED", "New dates proposed", `New possible dates for ${ctx.group.name}.`, {
    excludeUserId: req.userId,
  });

  res.status(201).json({ id: proposal.id, options: proposal.options });
});

const reviseSchema = proposeSchema;

// The leader's single allowed revision: add more date/time options and send
// the whole thing back to the Tribe for a fresh round of responses.
router.post("/groups/:id/social/revise-dates", async (req, res) => {
  const ctx = await requireSocialWorkingGroup(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  if (ctx.group.leaderId !== req.userId) return res.status(403).json({ error: "Only the Tribe leader can revise dates." });

  const existingEvent = await prisma.socialEvent.findUnique({ where: { groupId: ctx.group.id } });
  if (existingEvent) return res.status(400).json({ error: "A date is already confirmed for this Tribe." });

  const proposal = await prisma.socialEventProposal.findUnique({ where: { groupId: ctx.group.id } });
  if (!proposal) return res.status(400).json({ error: "Propose some dates first." });
  if (proposal.revisionUsed) return res.status(400).json({ error: "You've already used your one revision for this Tribe." });

  const requiredIds = await requiredSubmitterIds(ctx.group.id, ctx.group.leaderId);
  if (!(await allMembersSubmitted(proposal.id, requiredIds))) {
    return res.status(400).json({ error: "Wait for everyone to submit their availability before revising." });
  }

  const parsed = reviseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const anchor = ctx.group.socialScheduleWindowStart ?? ctx.group.updatedAt;
  if (!parsed.data.options.every((o) => withinProposalWindow(new Date(o.date), anchor))) {
    return res.status(400).json({ error: "Dates can only be picked within 2 weeks of this Tribe starting." });
  }

  await prisma.$transaction([
    prisma.socialDateOption.createMany({
      data: parsed.data.options.map((o) => ({
        proposalId: proposal.id,
        date: new Date(o.date),
        allDay: o.allDay,
        startTime: o.allDay ? null : o.startTime,
        endTime: o.allDay ? null : o.endTime,
      })),
    }),
    prisma.socialEventProposal.update({ where: { id: proposal.id }, data: { revisionUsed: true } }),
    prisma.socialProposalSubmission.deleteMany({ where: { proposalId: proposal.id } }),
  ]);

  await postSystemMessage(ctx.group.id, "The leader added more date options. Please resubmit your availability.");
  await notifyGroupMembers(ctx.group.id, "SOCIAL_SCHEDULING_OPENED", "Dates updated", `${ctx.group.name}: more date options were added. Resubmit your availability.`, {
    excludeUserId: req.userId,
  });

  res.json({ ok: true });
});

const respondSchema = z.object({ dateOptionId: z.string().min(1), available: z.boolean() });

// A member toggles availability on one of the leader's proposed dates. Only
// allowed while they haven't submitted their round yet.
router.post("/groups/:id/social/availability-responses", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only Tribe members can respond." });

  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const option = await prisma.socialDateOption.findFirst({
    where: { id: parsed.data.dateOptionId, proposal: { groupId: req.params.id } },
  });
  if (!option) return res.status(404).json({ error: "Date option not found." });

  const alreadyConfirmed = await prisma.socialEvent.findUnique({ where: { groupId: req.params.id } });
  if (alreadyConfirmed) return res.status(400).json({ error: "A date is already confirmed for this Tribe." });

  const alreadySubmitted = await prisma.socialProposalSubmission.findUnique({
    where: { proposalId_userId: { proposalId: option.proposalId, userId: req.userId! } },
  });
  if (alreadySubmitted) return res.status(400).json({ error: "You've already submitted your availability for this round." });

  await prisma.socialAvailabilityResponse.upsert({
    where: { dateOptionId_userId: { dateOptionId: option.id, userId: req.userId! } },
    create: { dateOptionId: option.id, userId: req.userId!, available: parsed.data.available },
    update: { available: parsed.data.available },
  });

  res.json({ ok: true });
});

const submitSchema = z.object({ availableDateOptionIds: z.array(z.string()).optional().default([]) });

// Locks in the member's responses for this round and, once everyone
// required has done the same, lets the leader know it's their turn.
router.post("/groups/:id/social/availability-submit", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only Tribe members can submit availability." });

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const group = await prisma.group.findFirst({ where: { id: req.params.id, tribeType: "SOCIAL" } });
  if (!group) return res.status(404).json({ error: "Social Tribe not found." });
  if (group.leaderId === req.userId) return res.status(400).json({ error: "The Tribe leader doesn't submit availability." });

  const proposal = await prisma.socialEventProposal.findUnique({ where: { groupId: group.id } });
  if (!proposal) return res.status(400).json({ error: "No dates have been proposed yet." });

  const alreadyConfirmed = await prisma.socialEvent.findUnique({ where: { groupId: group.id } });
  if (alreadyConfirmed) return res.status(400).json({ error: "A date is already confirmed for this Tribe." });

  const availableIds = new Set(parsed.data.availableDateOptionIds);
  const options = await prisma.socialDateOption.findMany({ where: { proposalId: proposal.id } });
  const existingResponses = await prisma.socialAvailabilityResponse.findMany({
    where: { userId: req.userId!, dateOptionId: { in: options.map((o) => o.id) } },
  });
  const respondedIds = new Set(existingResponses.map((r) => r.dateOptionId));
  const toCreate = options.filter((o) => !respondedIds.has(o.id));
  if (toCreate.length > 0) {
    await prisma.socialAvailabilityResponse.createMany({
      data: toCreate.map((o) => ({ dateOptionId: o.id, userId: req.userId!, available: availableIds.has(o.id) })),
    });
  }

  await prisma.socialProposalSubmission.upsert({
    where: { proposalId_userId: { proposalId: proposal.id, userId: req.userId! } },
    create: { proposalId: proposal.id, userId: req.userId! },
    update: {},
  });

  const requiredIds = await requiredSubmitterIds(group.id, group.leaderId);
  const allSubmitted = await allMembersSubmitted(proposal.id, requiredIds);
  if (allSubmitted) {
    await notifyUser(
      group.leaderId,
      "SOCIAL_AVAILABILITY_NEEDED",
      "Everyone's responded",
      `Everyone's submitted their availability for ${group.name}. Pick a date or revise the options.`,
      { groupId: group.id }
    );
  }

  res.json({ ok: true, allSubmitted });
});

const confirmSchema = z.object({ dateOptionId: z.string().min(1) });

// Leader confirms one date - creates the SocialEvent. Members who marked
// available for that specific option become "committed" (queried
// dynamically at attendance-recording time, not stored separately).
router.post("/groups/:id/social/confirm", async (req, res) => {
  const ctx = await requireSocialWorkingGroup(req.params.id);
  if ("error" in ctx) return res.status(400).json({ error: ctx.error });
  if (ctx.group.leaderId !== req.userId) return res.status(403).json({ error: "Only the Tribe leader can confirm a date." });

  const existing = await prisma.socialEvent.findUnique({ where: { groupId: ctx.group.id } });
  if (existing) return res.status(400).json({ error: "A date is already confirmed for this Tribe." });

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const option = await prisma.socialDateOption.findFirst({
    where: { id: parsed.data.dateOptionId, proposal: { groupId: ctx.group.id } },
  });
  if (!option) return res.status(404).json({ error: "Date option not found." });

  const requiredIds = await requiredSubmitterIds(ctx.group.id, ctx.group.leaderId);
  if (!(await allMembersSubmitted(option.proposalId, requiredIds))) {
    return res.status(400).json({ error: "Wait for everyone to submit their availability before confirming a date." });
  }

  await prisma.socialEvent.create({
    data: {
      groupId: ctx.group.id,
      confirmedDate: option.date,
      allDay: option.allDay,
      startTime: option.startTime,
      endTime: option.endTime,
    },
  });

  const availableResponses = await prisma.socialAvailabilityResponse.findMany({ where: { dateOptionId: option.id, available: true } });
  const dateLabel = option.allDay ? new Date(option.date).toDateString() : `${new Date(option.date).toDateString()} ${option.startTime}-${option.endTime}`;

  await postSystemMessage(ctx.group.id, `Date confirmed for ${dateLabel}.`);
  await notifyGroupMembers(ctx.group.id, "SOCIAL_DATE_SELECTED", "Date confirmed", `${ctx.group.name} is happening on ${dateLabel}.`, {
    onlyUserIds: availableResponses.map((r) => r.userId),
  });

  res.json({ ok: true });
});

// Committed members: every active member for a Fixed Date Tribe (no
// scheduling round - accepting membership commits you), or whoever marked
// available for the specific date that got confirmed for a Schedule
// Together Tribe. The leader is always included either way, mirroring how
// GET /me/home-summary unconditionally includes a Work task's owner
// regardless of their own availability responses.
async function getCommittedUserIds(
  group: { id: string; leaderId: string; dateType: string | null },
  socialEvent: { confirmedDate: Date }
): Promise<Set<string>> {
  const committedUserIds = new Set<string>();
  if (group.dateType === "FIXED") {
    const activeMembers = await prisma.groupMember.findMany({ where: { groupId: group.id, status: "ACTIVE" } });
    activeMembers.forEach((m) => committedUserIds.add(m.userId));
  } else {
    const responses = await prisma.socialAvailabilityResponse.findMany({
      where: { available: true, dateOption: { proposal: { groupId: group.id }, date: socialEvent.confirmedDate } },
    });
    responses.forEach((r) => committedUserIds.add(r.userId));
  }
  committedUserIds.add(group.leaderId);
  return committedUserIds;
}

// The leader's attendance-recording workspace: who's committed and needs an
// outcome recorded - the Social equivalent of GET .../tasks/:taskId/attendees.
router.get("/groups/:id/social/committed-members", async (req, res) => {
  const group = await prisma.group.findFirst({ where: { id: req.params.id, tribeType: "SOCIAL" } });
  if (!group) return res.status(404).json({ error: "Social Tribe not found." });
  const isMember = await requireGroupMember(group.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only Tribe members can view this." });

  const socialEvent = await prisma.socialEvent.findUnique({ where: { groupId: group.id } });
  if (!socialEvent) return res.json([]);

  const committedUserIds = await getCommittedUserIds(group, socialEvent);
  const users = await prisma.user.findMany({ where: { id: { in: [...committedUserIds] } } });

  res.json(users.map((u) => ({ userId: u.id, firstName: u.firstName, profilePhotoUrl: u.profilePhotoUrl })));
});

const attendanceSchema = z.object({
  attendance: z.array(
    z.object({
      userId: z.string().min(1),
      status: z.enum(["ATTENDED", "NO_SHOW", "VALID_REASON"]),
    })
  ),
});

// Leader records attendance once the confirmed event date has passed - no
// per-attendee star scoring here (unlike Work's task completion), since
// Social attendance never feeds a star rating, only Social Reliability.
// Sets the Tribe to COMPLETED on success, the same end-state Work Tribes
// reach once all tasks are settled.
router.post("/groups/:id/social/attendance", async (req, res) => {
  const group = await prisma.group.findFirst({ where: { id: req.params.id, tribeType: "SOCIAL" } });
  if (!group) return res.status(404).json({ error: "Social Tribe not found." });
  if (group.leaderId !== req.userId) return res.status(403).json({ error: "Only the Tribe leader can record attendance." });
  if (group.state !== "WORKING") return res.status(400).json({ error: "This Tribe isn't currently active." });

  const socialEvent = await prisma.socialEvent.findUnique({ where: { groupId: group.id } });
  if (!socialEvent) return res.status(400).json({ error: "No confirmed date for this Tribe yet." });
  if (socialEvent.confirmedDate > new Date()) {
    return res.status(400).json({ error: "You can record attendance once the event date has passed." });
  }

  const existing = await prisma.socialAttendance.findFirst({ where: { groupId: group.id } });
  if (existing) return res.status(400).json({ error: "Attendance has already been recorded for this Tribe." });

  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const committedUserIds = await getCommittedUserIds(group, socialEvent);
  const providedUserIds = new Set(parsed.data.attendance.map((a) => a.userId));
  if (committedUserIds.size !== providedUserIds.size || [...committedUserIds].some((id) => !providedUserIds.has(id))) {
    return res.status(400).json({ error: "Attendance must cover exactly the committed members." });
  }

  await prisma.socialAttendance.createMany({
    data: parsed.data.attendance.map((a) => ({ groupId: group.id, userId: a.userId, outcome: a.status })),
  });
  await prisma.group.update({ where: { id: group.id }, data: { state: "COMPLETED" } });

  await postSystemMessage(group.id, "Attendance recorded - this Tribe is complete. Leave whenever you're ready to wrap up.");
  await notifyGroupMembers(group.id, "SOCIAL_ATTENDANCE_RECORDED", "Tribe complete", `${group.name} is complete.`, {
    excludeUserId: req.userId,
  });

  res.json({ ok: true });
});

export default router;
