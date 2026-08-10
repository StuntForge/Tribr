import { apiFetch } from "./client";

export interface MemberSearchResult {
  id: string;
  firstName: string | null;
  age: number | null;
  gender: string | null;
  profilePhotoUrl: string | null;
  subscriptionTier: "FREE" | "SUBSCRIBER";
  locationLat: number | null;
  locationLng: number | null;
  approxDistanceMiles: number | null;
  overallRating: number | null;
  workerRating: number | null;
  hostRating: number | null;
  completedCycles: number;
  activeTasks: { id: string; name: string; category: string; jobLength: string | null }[];
}

export interface MemberSearchFilters {
  query?: string;
  categoryId?: string;
  jobLength?: string;
  minRating?: number;
  maxDistanceMiles?: number;
  ageMin?: number;
  ageMax?: number;
  gender?: string;
  hasPhoto?: boolean;
  favouritesOnly?: boolean;
}

export function searchMembers(filters: MemberSearchFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.jobLength) params.set("jobLength", filters.jobLength);
  if (filters.minRating != null) params.set("minRating", String(filters.minRating));
  if (filters.maxDistanceMiles != null) params.set("maxDistanceMiles", String(filters.maxDistanceMiles));
  if (filters.ageMin != null) params.set("ageMin", String(filters.ageMin));
  if (filters.ageMax != null) params.set("ageMax", String(filters.ageMax));
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.hasPhoto) params.set("hasPhoto", "true");
  if (filters.favouritesOnly) params.set("favouritesOnly", "true");
  const qs = params.toString();
  return apiFetch<MemberSearchResult[]>(`/api/members/search${qs ? `?${qs}` : ""}`);
}

export interface FavouriteUser {
  userId: string;
  firstName: string | null;
  isPro: boolean;
  overallRating: number | null;
}

export function getFavourites() {
  return apiFetch<FavouriteUser[]>("/api/me/favourites");
}

export function addFavourite(userId: string) {
  return apiFetch<{ ok: true }>("/api/me/favourites", { method: "POST", body: { userId } });
}

export function removeFavourite(userId: string) {
  return apiFetch<{ ok: true }>(`/api/me/favourites/${userId}`, { method: "DELETE" });
}
