import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { notifyUser } from "../services/notify";

const router = Router();
router.use(requireAuth);

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
      `${wd.task.name} — ${dateLabel}`,
      { taskId: wd.taskId, groupId: wd.task.groupId }
    );
  }
}

router.get("/", async (req, res) => {
  await generateDueReminders(req.userId!);

  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(
    notifications.map((n) => {
      const payload = n.payload ? JSON.parse(n.payload) : {};
      return {
        id: n.id,
        type: n.type,
        title: payload.title,
        body: payload.body,
        groupId: payload.groupId,
        read: n.read,
        createdAt: n.createdAt,
      };
    })
  );
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
