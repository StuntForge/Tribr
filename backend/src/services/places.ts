// Google Places API (New) - search-as-you-type autocomplete for a real,
// verifiable place, replacing the free OpenStreetMap/Nominatim lookup which
// (a) couldn't reliably find named venues (pubs, shops) and (b) kept
// silently failing from Render's shared IP being rate-limited.
//
// Cost shape (confirmed against Google's live pricing, not assumed):
// - Autocomplete is billed per-session when a sessionToken is supplied on
//   every keystroke request AND on the final Place Details call that
//   resolves the chosen suggestion - Session Usage is free at any volume.
//   Omitting the token, or generating a new one mid-search, falls back to
//   per-keystroke billing instead, which is NOT free past 10,000/month - so
//   every call site here requires a sessionToken, no exceptions.
// - Resolving a selected suggestion to real coordinates uses the "Essentials"
//   field tier (id, formattedAddress, location) rather than "Essentials
//   (IDs Only)" - only IDs Only is unlimited-free; Essentials-with-location
//   has a 10,000/month free cap, then a small per-request cost.
const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

export interface PlaceSuggestion {
  placeId: string;
  label: string;
}

export interface ResolvedPlace {
  label: string;
  lat: number;
  lng: number;
}

function requireApiKey(): string {
  if (!PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured.");
  }
  return PLACES_API_KEY;
}

export async function autocompletePlaces(input: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  const apiKey = requireApiKey();
  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // Only the fields needed to render a suggestion list and to make the
      // follow-up Place Details call - keeps the response (and the
      // session's data footprint) minimal.
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify({ input, sessionToken }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[places/autocomplete] Google ${res.status} for "${input}": ${body.slice(0, 300)}`);
    throw new Error("Place search is temporarily unavailable.");
  }

  const data = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; text?: { text: string } } }[] };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is { placeId: string; text?: { text: string } } => Boolean(p?.placeId && p.text?.text))
    .map((p) => ({ placeId: p.placeId, label: p.text!.text }));
}

export async function resolvePlace(placeId: string, sessionToken: string): Promise<ResolvedPlace | null> {
  const apiKey = requireApiKey();
  const url = `${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      // "formattedAddress" + "location" fall under the paid Essentials tier
      // (not the free IDs-only one) - deliberately requesting nothing beyond
      // that (no photos, ratings, opening hours, etc.) to stay on the
      // cheapest tier that still returns real coordinates.
      "X-Goog-FieldMask": "id,formattedAddress,location",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[places/details] Google ${res.status} for placeId "${placeId}": ${body.slice(0, 300)}`);
    throw new Error("Couldn't resolve that place - please try again.");
  }

  const data = (await res.json()) as { formattedAddress?: string; location?: { latitude: number; longitude: number } };
  if (!data.location || !Number.isFinite(data.location.latitude) || !Number.isFinite(data.location.longitude)) {
    return null;
  }
  return {
    label: data.formattedAddress ?? "",
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}
