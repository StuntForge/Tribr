import { apiFetch } from "./client";

export interface PlaceSuggestion {
  placeId: string;
  label: string;
}

export interface ResolvedPlace {
  label: string;
  lat: number;
  lng: number;
}

// sessionToken must be the same value across every keystroke search AND the
// final resolve() call for one search, then discarded - that's what puts
// the whole thing on Google's free Session Usage billing tier instead of
// the metered per-keystroke one. See PostcodeInput.tsx for how it's managed.
export function searchPlaces(query: string, sessionToken: string, signal?: AbortSignal) {
  return apiFetch<PlaceSuggestion[]>(
    `/api/geocode/search?q=${encodeURIComponent(query)}&sessionToken=${encodeURIComponent(sessionToken)}`,
    { signal }
  );
}

export function resolvePlace(placeId: string, sessionToken: string) {
  return apiFetch<ResolvedPlace>(
    `/api/geocode/resolve?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`
  );
}
