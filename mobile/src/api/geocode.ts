import { apiFetch } from "./client";

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export function searchPlaces(query: string, signal?: AbortSignal) {
  return apiFetch<PlaceSuggestion[]>(`/api/geocode/search?q=${encodeURIComponent(query)}`, { signal });
}

export function reverseGeocode(lat: number, lng: number) {
  return apiFetch<PlaceSuggestion | null>(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
}
