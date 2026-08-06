import { apiFetch } from "./client";

export interface MemberSearchResult {
  id: string;
  firstName: string | null;
  approxDistanceMiles: number | null;
  overallRating: number | null;
  workerRating: number | null;
  hostRating: number | null;
  skills: string[];
  tools: string[];
  activeTasks: { id: string; name: string; category: string }[];
}

export interface MemberSearchFilters {
  query?: string;
  categoryId?: string;
  minRating?: number;
  maxDistanceMiles?: number;
}

export function searchMembers(filters: MemberSearchFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.minRating != null) params.set("minRating", String(filters.minRating));
  if (filters.maxDistanceMiles != null) params.set("maxDistanceMiles", String(filters.maxDistanceMiles));
  const qs = params.toString();
  return apiFetch<MemberSearchResult[]>(`/api/members/search${qs ? `?${qs}` : ""}`);
}

export interface FavouriteUser {
  userId: string;
  firstName: string | null;
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
