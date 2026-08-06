import { Router } from "express";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { getStripe, stripeConfigured } from "../services/stripe";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const sub = await prisma.subscription.findUnique({ where: { userId: req.userId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  res.json({
    tier: user.subscriptionTier,
    status: sub?.status ?? "INACTIVE",
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    stripeConfigured: stripeConfigured(),
  });
});

async function getOrCreateStripeCustomer(userId: string, email: string | undefined) {
  const stripe = getStripe();
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe.customers.create({ metadata: { userId }, ...(email ? { email } : {}) });
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

const checkoutSchema = z.object({ redirectUri: z.string().url() });

// 8.5 - subscribing unlocks Subscriber features. Uses Stripe Checkout
// (hosted page) so no card details ever pass through our own servers.
router.post("/checkout", async (req, res) => {
  if (!stripeConfigured()) return res.status(503).json({ error: "Billing isn't configured yet." });
  if (!process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: "Run `npm run stripe:setup` in backend/ first to create the subscription price." });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(req.userId!, undefined);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: req.userId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${parsed.data.redirectUri}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${parsed.data.redirectUri}?cancelled=1`,
  });

  res.json({ url: session.url, sessionId: session.id });
});

// Synchronous fallback so subscribing works instantly during local dev,
// without needing the Stripe CLI running to forward webhooks (see /webhook).
router.post("/confirm", async (req, res) => {
  if (!stripeConfigured()) return res.status(503).json({ error: "Billing isn't configured yet." });
  const sessionId = String(req.body.sessionId ?? "");
  if (!sessionId) return res.status(400).json({ error: "sessionId is required." });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== req.userId) return res.status(403).json({ error: "This session isn't yours." });
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return res.status(400).json({ error: "Payment hasn't completed yet." });
  }

  const subscription = session.subscription as Stripe.Subscription | null;
  await applySubscriptionState(req.userId!, session.customer as string, subscription);

  res.json({ ok: true, tier: "SUBSCRIBER" });
});

router.post("/portal", async (req, res) => {
  if (!stripeConfigured()) return res.status(503).json({ error: "Billing isn't configured yet." });
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const sub = await prisma.subscription.findUnique({ where: { userId: req.userId } });
  if (!sub?.stripeCustomerId) return res.status(400).json({ error: "No billing account found yet." });

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: parsed.data.redirectUri,
  });

  res.json({ url: session.url });
});

async function applySubscriptionState(
  userId: string,
  stripeCustomerId: string,
  subscription: Stripe.Subscription | null
) {
  const active = subscription ? ["active", "trialing"].includes(subscription.status) : false;
  const currentPeriodEnd = subscription?.items?.data?.[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000)
    : null;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription?.id,
      status: active ? "ACTIVE" : "INACTIVE",
      currentPeriodEnd,
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId: subscription?.id,
      status: active ? "ACTIVE" : subscription ? "CANCELED" : "INACTIVE",
      currentPeriodEnd,
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { subscriptionTier: active ? "SUBSCRIBER" : "FREE" } });
}

export default router;
export { applySubscriptionState };
