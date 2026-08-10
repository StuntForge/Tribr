import { apiFetch } from "./client";

export interface Profile {
  id: string;
  phone: string;
  firstName: string | null;
  age: number | null;
  gender: string | null;
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
  homeAddress: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  profileComplete: boolean;
  subscriptionTier: "FREE" | "SUBSCRIBER";
  dietary: string[];
  allergyDetail: string | null;
  photos: { id: string; url: string }[];
  overallRating: number | null;
  workerRating: number | null;
  hostRating: number | null;
  completedCycles: number;
  completedTasksCount: number;
  lookingForGroup: boolean;
}

export function getMe() {
  return apiFetch<Profile>("/api/me");
}

export interface RatingBreakdown {
  worker: { performance: number | null; attitude: number | null; reliability: number | null; count: number };
  host: { hosting: number | null; accuracy: number | null; attitude: number | null; count: number };
}

export function getMyRatingBreakdown() {
  return apiFetch<RatingBreakdown>("/api/me/rating-breakdown");
}

export function setLookingForGroup(lookingForGroup: boolean) {
  return apiFetch<{ lookingForGroup: boolean }>("/api/me/looking-for-group", {
    method: "PUT",
    body: { lookingForGroup },
  });
}

export interface UpdateProfileInput {
  firstName?: string;
  age?: number;
  gender?: string;
  locationLabel?: string;
  locationLat?: number;
  locationLng?: number;
  bio?: string;
  profilePhotoUrl?: string;
}

export function updateMe(input: UpdateProfileInput) {
  return apiFetch<Profile>("/api/me", { method: "PUT", body: input });
}

export function setDietary(types: string[], allergyDetail?: string) {
  return apiFetch<{ types: string[]; allergyDetail: string | null }>("/api/me/dietary", {
    method: "PUT",
    body: { types, allergyDetail },
  });
}

// Dev-only stand-in for real subscription billing (Milestone 7 / Stripe).
export function toggleSubscriptionDev() {
  return apiFetch<{ subscriptionTier: "FREE" | "SUBSCRIBER" }>("/api/dev/toggle-subscription", { method: "POST" });
}

export interface PublicProfile {
  id: string;
  firstName: string | null;
  age: number | null;
  gender: string | null;
  isPro: boolean;
  approxDistanceMiles: number | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  photos: { id: string; url: string }[];
  overallRating: number | null;
  workerRating: number | null;
  hostRating: number | null;
  completedCycles: number;
  completedTasksCount: number;
}

export function getPublicProfile(userId: string) {
  return apiFetch<PublicProfile>(`/api/users/${userId}`);
}

export interface PublicTaskSummary {
  id: string;
  name: string;
  category: { id: string; name: string };
  description: string;
  jobLength: string | null;
  locationLabel: string | null;
  status: string;
  photos: { id: string; url: string }[];
  ownerId: string;
  ownerFirstName: string | null;
}

export function getUserTasks(userId: string) {
  return apiFetch<PublicTaskSummary[]>(`/api/users/${userId}/tasks`);
}

export function blockUser(userId: string) {
  return apiFetch<{ ok: true }>(`/api/users/${userId}/block`, { method: "POST" });
}

export function unblockUser(userId: string) {
  return apiFetch<{ ok: true }>(`/api/users/${userId}/block`, { method: "DELETE" });
}

export interface BlockedUser {
  userId: string;
  firstName: string | null;
  profilePhotoUrl: string | null;
  blockedAt: string;
}

export function getBlockedUsers() {
  return apiFetch<BlockedUser[]>("/api/me/blocked");
}

export function reportUser(userId: string, reason: string, details?: string) {
  return apiFetch<{ id: string }>(`/api/users/${userId}/report`, { method: "POST", body: { reason, details } });
}

// Mobile number change and account self-deletion were intentionally removed
// (see backend/src/routes/profile.ts) - the phone number is the account's
// permanent identity, and self-deletion enabled a rate-and-ditch abuse
// pattern. No client functions for either on purpose.
