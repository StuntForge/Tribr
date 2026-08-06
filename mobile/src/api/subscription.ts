import { apiFetch } from "./client";

export interface SubscriptionStatus {
  tier: "FREE" | "SUBSCRIBER";
  status: string;
  currentPeriodEnd: string | null;
  stripeConfigured: boolean;
}

export function getSubscriptionStatus() {
  return apiFetch<SubscriptionStatus>("/api/subscription");
}

export function createCheckoutSession(redirectUri: string) {
  return apiFetch<{ url: string; sessionId: string }>("/api/subscription/checkout", {
    method: "POST",
    body: { redirectUri },
  });
}

export function confirmCheckout(sessionId: string) {
  return apiFetch<{ ok: true; tier: "SUBSCRIBER" }>("/api/subscription/confirm", {
    method: "POST",
    body: { sessionId },
  });
}

export function createBillingPortalSession(redirectUri: string) {
  return apiFetch<{ url: string }>("/api/subscription/portal", { method: "POST", body: { redirectUri } });
}
