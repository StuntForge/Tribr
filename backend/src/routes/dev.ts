import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { enforceFreeTaskLimit } from "./tasks";

// Dev-only stand-in for real subscription billing (Milestone 7 / Stripe).
// Lets the app be tested end-to-end before payments exist. Disabled whenever
// a real SMS provider is configured, as a simple proxy for "not production".
const router = Router();

router.use((req, res, next) => {
  if ((process.env.SMS_PROVIDER ?? "dev") !== "dev") {
    return res.status(404).json({ error: "Not found." });
  }
  next();
});

router.use(requireAuth);

router.post("/toggle-subscription", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const nextTier = user.subscriptionTier === "SUBSCRIBER" ? "FREE" : "SUBSCRIBER";
  const updated = await prisma.user.update({ where: { id: user.id }, data: { subscriptionTier: nextTier } });
  if (nextTier === "FREE") await enforceFreeTaskLimit(user.id);
  res.json({ subscriptionTier: updated.subscriptionTier });
});

export default router;
