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
  skills: { id: string; label: string }[];
  tools: { id: string; label: string }[];
  dietary: string[];
  photos: { id: string; url: string }[];
  overallRating: number | null;
  workerRating: number | null;
  hostRating: number | null;
  completedCycles: number;
}

export function getMe() {
  return apiFetch<Profile>("/api/me");
}

export interface UpdateProfileInput {
  firstName?: string;
  age?: number;
  gender?: string;
  locationLabel?: string;
  locationLat?: number;
  locationLng?: number;
  homeAddress?: string;
  bio?: string;
  profilePhotoUrl?: string;
}

export function updateMe(input: UpdateProfileInput) {
  return apiFetch<Profile>("/api/me", { method: "PUT", body: input });
}

export function addSkill(label: string) {
  return apiFetch<{ id: string; label: string }>("/api/me/skills", { method: "POST", body: { label } });
}

export function removeSkill(id: string) {
  return apiFetch<{ ok: true }>(`/api/me/skills/${id}`, { method: "DELETE" });
}

export function addTool(label: string) {
  return apiFetch<{ id: string; label: string }>("/api/me/tools", { method: "POST", body: { label } });
}

export function removeTool(id: string) {
  return apiFetch<{ ok: true }>(`/api/me/tools/${id}`, { method: "DELETE" });
}

export function setDietary(types: string[]) {
  return apiFetch<{ types: string[] }>("/api/me/dietary", { method: "PUT", body: { types } });
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
  approxDistanceMiles: number | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  photos: { id: string; url: string }[];
  skills: string[];
  tools: string[];
  overallRating: number | null;
  workerRating: number | null;
  hostRating: number | null;
  completedCycles: number;
}

export function getPublicProfile(userId: string) {
  return apiFetch<PublicProfile>(`/api/users/${userId}`);
}

export function blockUser(userId: string) {
  return apiFetch<{ ok: true }>(`/api/users/${userId}/block`, { method: "POST" });
}

export function reportUser(userId: string, reason: string, details?: string) {
  return apiFetch<{ id: string }>(`/api/users/${userId}/report`, { method: "POST", body: { reason, details } });
}

// ---- Mobile number change (10.6) ----

export function requestPhoneChange(newPhone: string) {
  return apiFetch<{ ok: true }>("/api/me/change-phone/request", { method: "POST", body: { newPhone } });
}

export function confirmPhoneChange(newPhone: string, code: string) {
  return apiFetch<{ phone: string }>("/api/me/change-phone/confirm", { method: "POST", body: { newPhone, code } });
}

// ---- Account deletion (10.8) ----

export interface DeleteAccountResult {
  deferred: boolean;
  message: string;
  blockingGroups?: string[];
}

export function requestAccountDeletion() {
  return apiFetch<DeleteAccountResult>("/api/me/delete-request", { method: "POST" });
}

export function cancelAccountDeletion() {
  return apiFetch<{ ok: true }>("/api/me/cancel-deletion", { method: "POST" });
}
