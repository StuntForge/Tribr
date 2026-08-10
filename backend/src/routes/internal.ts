import { Router } from "express";
import { prisma } from "../db";
import { sendPush } from "../services/push";
import { computeActionItems } from "./notifications";

const router = Router();

// Not behind requireAuth - this is hit by an external hourly trigger (see
// .github/workflows/hourly-digest.yml), not a logged-in user, so it's gated
// by a shared secret header instead.
function localHour(timeZone: string, date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(date);
  return Number(hourStr) % 24;
}

function localDateKey(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// 8.x - daily "you've still got things to do" digest, fired once per user at
// midday in *their* timezone. There's no background worker on this hosting
// plan, so instead this endpoint is triggered by an external hourly cron
// (GitHub Actions) and itself figures out which of the checked-in users are
// currently at their local midday, deduping via lastDigestSentAt so an
// hourly trigger can never double-send within the same local day.
router.post("/digest-tick", async (req, res) => {
  if (!process.env.DIGEST_SECRET || req.header("x-digest-secret") !== process.env.DIGEST_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", expoPushToken: { not: null }, timezone: { not: null } },
    select: { id: true, timezone: true, lastDigestSentAt: true },
  });

  let sent = 0;
  for (const user of users) {
    const tz = user.timezone!;
    let hour: number;
    let todayKey: string;
    try {
      hour = localHour(tz);
      todayKey = localDateKey(tz);
    } catch {
      continue; // an invalid/unrecognised IANA timezone string - skip rather than 500 the whole batch
    }
    if (hour !== 12) continue;
    if (user.lastDigestSentAt && localDateKey(tz, user.lastDigestSentAt) === todayKey) continue;

    const items = await computeActionItems(user.id);
    if (items.length === 0) continue;

    await sendPush(
      user.id,
      "Action needed",
      `You have ${items.length} thing${items.length === 1 ? "" : "s"} needing your attention in your Tribes.`,
      { type: "DAILY_DIGEST" }
    );
    await prisma.user.update({ where: { id: user.id }, data: { lastDigestSentAt: new Date() } });
    sent++;
  }

  res.json({ ok: true, checked: users.length, sent });
});

export default router;
