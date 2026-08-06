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
