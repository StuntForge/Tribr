// Best-effort geocoding for a typed location label (e.g. "Derby, UK") into
// approximate coordinates - lets map view work for users who type their
// location instead of granting GPS permission (the only other way lat/lng
// gets set). Uses OpenStreetMap's free Nominatim API; a descriptive
// User-Agent is required by their usage policy. Never throws - a failed or
// empty lookup just means the profile saves without coordinates, same as
// before this existed.
export async function geocodeLabel(label: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ProjectExchange/1.0 (dev testing; contact via app)" },
    });
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
