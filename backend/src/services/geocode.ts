// Shared OpenStreetMap Nominatim access for the whole backend - used both
// by this module's own geocodeLabel() (best-effort geocode of a typed
// profile location) and by routes/geocode.ts (the live search/reverse
// endpoints proxied to the mobile app). Nominatim's usage policy caps
// traffic at 1 request/second *for the whole app* (identified by the shared
// User-Agent below), not per-caller, so every outbound call from anywhere
// in the backend is serialized through the same queue - two independent
// unthrottled call sites could together blow the budget and get the
// User-Agent rate-limited or banned, which would silently break location
// search/geocoding for every user, not just whoever triggered it.
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
