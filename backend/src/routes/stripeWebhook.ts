import { Router } from "express";
import { prisma } from "../db";
import { getStripe, stripeConfigured } from "../services/stripe";
import { applySubscriptionState } from "./subscription";
import type Stripe from "stripe";

// 8.5 - keeps subscription status in sync for events that happen outside an
// active app session (renewals, failed payments, cancelling via the Stripe
// customer portal). The /confirm endpoint already covers the common "just
// subscribed" case instantly; this is the belt-and-braces path.
//
// Testing locally requires the Stripe CLI: `stripe listen --forward-to
// localhost:4000/api/stripe/webhook`, which prints a temporary webhook
// signing secret to put in STRIPE_WEBHOOK_SECRET.
const router = Router();

router.post("/", async (req, res) => {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Webhook not configured." });
  }

  const stripe = getStripe();
  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature as string, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const record = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (record) {
      await applySubscriptionState(record.userId, customerId, event.type === "customer.subscription.deleted" ? null : subscription);
    }
  }

  res.json({ received: true });
});

export default router;
