// OpenStreetMap Nominatim access, now used only by this module's own
// geocodeLabel() (best-effort geocode of a typed profile location, called
// from profile.ts's PUT /me). The live search/resolve endpoints in
// routes/geocode.ts moved to Google Places this session - see
// services/places.ts - so this is no longer shared with them. Kept as a
// narrow fallback rather than removed: geocodeLabel runs unattended off a
// plain typed label with no session token, so it doesn't fit Places'
// session-billing model the way the live search flow does.
// Nominatim's usage policy caps traffic at 1 request/second for the whole
// app (identified by the shared User-Agent below), so calls are still
// serialized through this queue even with a single caller - cheap
// insurance against a future second call site reintroducing the problem.
const USER_AGENT = "Tribr/1.0 (dev testing; contact via app)";
const MIN_GAP_MS = 1100;
let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

export function throttledNominatimFetch(url: string): Promise<Response> {
  const run = queueTail.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10000) });
  });
  // Keep the chain alive regardless of this call's outcome, so one failed
  // lookup can't wedge every request after it.
  queueTail = run.catch(() => undefined);
  return run;
}

// Best-effort geocoding for a typed location label (e.g. "Derby, UK") into
// approximate coordinates - lets map view work for users who type their
// location instead of granting GPS permission (the only other way lat/lng
// gets set). Never throws - a failed or empty lookup just means the profile
// saves without coordinates, same as before this existed.
export async function geocodeLabel(label: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await throttledNominatimFetch(url);
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
