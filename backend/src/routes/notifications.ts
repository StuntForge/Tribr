import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { notifyUser } from "../services/notify";
import { getCurrentCycle, parseOrder } from "./groups";

const router = Router();
router.use(requireAuth);

// 8.x - the device registers (or re-registers, on every app launch - tokens
// can change) its Expo push token plus its IANA timezone, the latter used
// only for the daily midday digest.
const pushTokenSchema = z.object({ token: z.string().min(1), timezone: z.string().min(1).optional() });

router.post("/me/push-token", async (req, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  await prisma.user.update({
    where: { id: req.userId },
    data: { expoPushToken: parsed.data.token, ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}) },
  });
  res.json({ ok: true });
});

// These types now surface as live "Action Needed" items instead (see
// /me/action-items below) - keeping them out of the plain feed avoids
// showing the same thing twice, once as a dismissible FYI and once as a
// thing you actually have to do.
const ACTION_ITEM_TYPES = [
  "DATES_PROPOSED",
  "DATES_REVISED",
  "AVAILABILITY_READY",
  "RATE_HOST_PENDING",
  "KICK_VOTE_STARTED",
  "TASK_ACTIVE",
  "APPLICATION_TASK_REQUESTED",
  "SOCIAL_SCHEDULING_OPENED",
  "SOCIAL_AVAILABILITY_NEEDED",
];

// 5.11 - reminders. There's no background scheduler yet, so instead of a
// worker firing at exactly T-24h / same-day, we generate the reminder the
// first time the user opens the app inside that window (deduped so it only
// happens once per work day). Good enough until real push infra exists;
// 10.11 already requires reminders to work from the in-app centre regardless.
async function generateDueReminders(userId: string) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const myGroupIds = (await prisma.groupMember.findMany({ where: { userId, status: "ACTIVE" } })).map((m) => m.groupId);
  if (myGroupIds.length === 0) return;

  const workDays = await prisma.workDay.findMany({
    where: { task: { groupId: { in: myGroupIds } }, confirmedDate: { gte: now, lte: in24h } },
    include: { task: true },
  });

  for (const wd of workDays) {
    // Only remind people actually expected to attend (5.10): the owner, or
    // members who marked themselves available for this date.
    const isOwner = wd.task.ownerId === userId;
    const response = await prisma.availabilityResponse.findFirst({
      where: { userId, available: true, dateOption: { proposal: { taskId: wd.taskId }, date: wd.confirmedDate } },
    });
    if (!isOwner && !response) continue;

    const dateLabel = wd.allDay ? wd.confirmedDate.toDateString() : `${wd.confirmedDate.toDateString()} ${wd.startTime}-${wd.endTime}`;
    const isSameDay = wd.confirmedDate <= endOfToday;
    const type = isSameDay ? "REMINDER_SAME_DAY" : "REMINDER_24H";

    const already = await prisma.notification.findFirst({ where: { userId, type: `${type}:${wd.id}` } });
    if (already) continue;

    await notifyUser(
      userId,
      `${type}:${wd.id}`,
      isSameDay ? "Work day is today" : "Work day tomorrow",
      `${wd.task.name} - ${dateLabel}`,
      { taskId: wd.taskId, taskName: wd.task.name, groupId: wd.task.groupId }
    );
  }
}

router.get("/", async (req, res) => {
  await generateDueReminders(req.userId!);

  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId, type: { notIn: ACTION_ITEM_TYPES } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const parsed = notifications.map((n) => ({ n, payload: n.payload ? JSON.parse(n.payload) : {} }));
  const groupIds = [...new Set(parsed.map((p) => p.payload.groupId).filter(Boolean))];
  const groups = groupIds.length > 0 ? await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }) : [];
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  res.json(
    parsed.map(({ n, payload }) => ({
      id: n.id,
      type: n.type,
      title: payload.title,
      body: payload.body,
      groupId: payload.groupId,
      groupName: payload.groupId ? groupNameById.get(payload.groupId) ?? null : null,
      taskId: payload.taskId,
      voteId: payload.voteId,
      read: n.read,
      createdAt: n.createdAt,
    }))
  );
});

export interface ActionItem {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: Date;
  groupId?: string;
  groupName?: string;
  taskId?: string;
  taskName?: string;
  voteId?: string;
}

// The "Action Needed" tab - unlike the plain notification feed, nothing
// here is a stored row the user can dismiss. Each item is derived live from
// current app state, so it can only disappear by the underlying thing
// actually getting done (submit availability, pick a date, cast a ballot,
// etc), never by swiping it away. Exported (rather than inlined in the
// route) so the daily digest can reuse the exact same "what does this user
// still need to do" computation instead of drifting out of sync with it.
export async function computeActionItems(userId: string): Promise<ActionItem[]> {
  const items: ActionItem[] = [];

  const memberships = await prisma.groupMember.findMany({
    where: { userId, status: "ACTIVE", group: { state: { notIn: ["DISBANDED"] } } },
    include: { group: true },
  });

  for (const m of memberships) {
    if (m.group.state === "WORKING" && m.group.tribeType === "WORK") {
      const cycle = await getCurrentCycle(m.groupId, m.group.currentCycleNumber);
      const order = cycle ? parseOrder(cycle) : [];
      if (order.length > 0) {
        const activeTask = await prisma.task.findUnique({ where: { id: order[0] } });
        if (activeTask) {
          const workDay = await prisma.workDay.findUnique({ where: { taskId: activeTask.id } });
          const proposal = workDay
            ? null
            : await prisma.availabilityProposal.findFirst({
                where: { taskId: activeTask.id },
                orderBy: { createdAt: "desc" },
                include: { submissions: true },
              });

          if (activeTask.ownerId === userId) {
            if (!workDay && !proposal) {
              items.push({
                id: `propose:${activeTask.id}`,
                type: "PROPOSE_DATES",
                title: "Propose work dates",
                body: `Propose dates for "${activeTask.name}" in ${m.group.name}.`,
                createdAt: activeTask.activatedAt ?? activeTask.updatedAt,
                groupId: m.groupId,
                taskId: activeTask.id,
                taskName: activeTask.name,
              });
            } else if (!workDay && proposal) {
              const requiredIds = (
                await prisma.groupMember.findMany({ where: { groupId: m.groupId, status: "ACTIVE" } })
              )
                .map((x) => x.userId)
                .filter((id) => id !== userId);
              const allSubmitted = requiredIds.every((id) => proposal.submissions.some((s) => s.userId === id));
              if (allSubmitted) {
                items.push({
                  id: `pick:${activeTask.id}`,
                  type: "PICK_DATE",
                  title: "Pick a date",
                  body: `Everyone's responded for "${activeTask.name}" - pick a date or revise.`,
                  createdAt: proposal.createdAt,
                  groupId: m.groupId,
                  taskId: activeTask.id,
                  taskName: activeTask.name,
                });
              }
            }
          } else if (!workDay && proposal) {
            const submitted = proposal.submissions.some((s) => s.userId === userId);
            if (!submitted) {
              items.push({
                id: `submit:${activeTask.id}`,
                type: "SUBMIT_AVAILABILITY",
                title: "Submit your availability",
                body: `Let ${m.group.name} know when you're free for "${activeTask.name}".`,
                createdAt: proposal.createdAt,
                groupId: m.groupId,
                taskId: activeTask.id,
                taskName: activeTask.name,
              });
            }
          }
        }
      }
    }

    if (m.group.state === "WORKING" && m.group.tribeType === "SOCIAL") {
      const socialEvent = await prisma.socialEvent.findUnique({ where: { groupId: m.groupId } });

      if (!socialEvent && m.group.dateType === "SCHEDULE_TOGETHER") {
        const proposal = await prisma.socialEventProposal.findUnique({
          where: { groupId: m.groupId },
          include: { submissions: true },
        });

        if (m.group.leaderId === userId) {
          if (!proposal) {
            items.push({
              id: `social-propose:${m.groupId}`,
              type: "SOCIAL_PROPOSE_DATES",
              title: "Propose dates",
              body: `Propose dates for ${m.group.name}.`,
              createdAt: m.group.socialScheduleWindowStart ?? m.group.updatedAt,
              groupId: m.groupId,
              groupName: m.group.name,
            });
          } else {
            const requiredIds = (await prisma.groupMember.findMany({ where: { groupId: m.groupId, status: "ACTIVE" } }))
              .map((x) => x.userId)
              .filter((id) => id !== userId);
            const allSubmitted = requiredIds.every((id) => proposal.submissions.some((s) => s.userId === id));
            if (allSubmitted) {
              items.push({
                id: `social-pick:${m.groupId}`,
                type: "SOCIAL_PICK_DATE",
                title: "Pick a date",
                body: `Everyone's responded for ${m.group.name} - pick a date or revise.`,
                createdAt: proposal.createdAt,
                groupId: m.groupId,
                groupName: m.group.name,
              });
            }
          }
        } else if (proposal) {
          const submitted = proposal.submissions.some((s) => s.userId === userId);
          if (!submitted) {
            items.push({
              id: `social-submit:${m.groupId}`,
              type: "SOCIAL_SUBMIT_AVAILABILITY",
              title: "Submit your availability",
              body: `Let ${m.group.name} know when you're free.`,
              createdAt: proposal.createdAt,
              groupId: m.groupId,
              groupName: m.group.name,
            });
          }
        }
      }

      if (socialEvent && m.group.leaderId === userId && socialEvent.confirmedDate <= new Date()) {
        const attendanceRecorded = await prisma.socialAttendance.findFirst({ where: { groupId: m.groupId } });
        if (!attendanceRecorded) {
          items.push({
            id: `social-attendance:${m.groupId}`,
            type: "SOCIAL_ATTENDANCE_PENDING",
            title: "Record attendance",
            body: `Record who attended ${m.group.name}.`,
            createdAt: socialEvent.confirmedDate,
            groupId: m.groupId,
            groupName: m.group.name,
          });
        }
      }
    }

    if (m.group.leaderId === userId) {
      const pendingApps = await prisma.groupApplication.findMany({
        where: { groupId: m.groupId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      if (pendingApps.length > 0) {
        items.push({
          id: `applications:${m.groupId}`,
          type: "REVIEW_APPLICATIONS",
          title: "Review applications",
          body: `${pendingApps.length} pending application${pendingApps.length === 1 ? "" : "s"} for ${m.group.name}.`,
          createdAt: pendingApps[0].createdAt,
          groupId: m.groupId,
        });
      }
    }

    const openVotes = await prisma.kickVote.findMany({ where: { groupId: m.groupId, outcome: null } });
    for (const v of openVotes) {
      if (v.targetUserId === userId) continue;
      const already = await prisma.kickBallot.findFirst({ where: { voteId: v.id, voterId: userId } });
      if (already) continue;
      const target = await prisma.user.findUnique({ where: { id: v.targetUserId } });
      items.push({
        id: `kickvote:${v.id}`,
        type: "KICK_VOTE",
        title: "Vote on member removal",
        body: `Vote on removing ${target?.firstName} from ${m.group.name}.`,
        createdAt: v.createdAt,
        groupId: m.groupId,
        voteId: v.id,
      });
    }
  }

  // A leader asking for a different task leaves the application sitting in
  // TASK_REQUESTED indefinitely otherwise - nothing else prompts the
  // applicant to actually go resolve it.
  const taskRequestedApplications = await prisma.groupApplication.findMany({
    where: { applicantId: userId, status: "TASK_REQUESTED" },
    include: { group: true },
  });
  for (const a of taskRequestedApplications) {
    items.push({
      id: `task-requested:${a.id}`,
      type: "APPLICATION_TASK_REQUESTED",
      title: "Choose a different task",
      body: `${a.group.name}'s leader asked you to submit a different task${a.rejectionReason ? `: ${a.rejectionReason}` : "."}`,
      createdAt: a.updatedAt,
      groupId: a.groupId,
    });
  }

  const attendedEvents = await prisma.ratingEvent.findMany({
    where: { rateeId: userId, type: "WORKER", isNoShow: false, isValidAbsence: false },
    include: { task: { include: { group: true } } },
  });
  const alreadyRatedTaskIds = new Set(
    (await prisma.ratingEvent.findMany({ where: { raterId: userId, type: "HOST" }, select: { taskId: true } })).map(
      (r) => r.taskId
    )
  );
  const seenTaskIds = new Set<string>();
  for (const e of attendedEvents) {
    // Defensive: a user should never be asked to rate a task they own,
    // however that WORKER rating ended up recorded against them.
    if (e.task.ownerId === userId) continue;
    if (alreadyRatedTaskIds.has(e.taskId) || seenTaskIds.has(e.taskId)) continue;
    seenTaskIds.add(e.taskId);
    items.push({
      id: `rate:${e.taskId}`,
      type: "RATE_HOST",
      title: "Rate the host",
      body: `How was "${e.task.name}"? Rate ${e.task.group?.name ?? "the group"}'s host.`,
      createdAt: e.createdAt,
      groupId: e.task.groupId ?? undefined,
      taskId: e.taskId,
      taskName: e.task.name,
    });
  }

  items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return items;
}

router.get("/me/action-items", async (req, res) => {
  res.json(await computeActionItems(req.userId!));
});

// Swiping a notification away removes it outright - there's no "archive"
// concept for these, just the live feed.
router.delete("/:id", async (req, res) => {
  await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});

router.delete("/", async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.userId } });
  res.json({ ok: true });
});

router.post("/:id/read", async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { read: true } });
  res.json({ ok: true });
});

router.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
  res.json({ ok: true });
});

export default router;
