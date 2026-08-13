import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { throttledNominatimFetch } from "../services/geocode";

const router = Router();
router.use(requireAuth);

// Short-lived cache so repeat keystrokes on the same query (or two users
// searching the same place) don't each cost a slot in Nominatim's shared
// 1 req/sec budget (see services/geocode.ts's throttledNominatimFetch).
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map<string, { at: number; results: { label: string; lat: number; lng: number }[] }>();

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// 11.x - free, keyless address/place autocomplete via OpenStreetMap's
// Nominatim, proxied through the backend (mirrors how Cloudinary uploads
// are proxied rather than hit directly from the client). Chosen over a
// paid provider (Mapbox/Google) specifically to avoid any billing
// requirement - see services/geocode.ts, which already uses the same
// service as a one-shot fallback elsewhere in the app.
router.get("/geocode/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 3) return res.json([]);

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
    return res.json(cached.results);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
    const response = await throttledNominatimFetch(url);
    if (!response.ok) {
      // A rejected/rate-limited request from Nominatim used to come back as
      // the exact same shape as "genuinely zero results" (a 200 with []),
      // which is indistinguishable to the user from a real empty search -
      // logged and reported as a real failure instead, so the app can tell
      // the difference and the actual cause is visible in server logs.
      const body = await response.text().catch(() => "");
      console.error(`[geocode/search] Nominatim ${response.status} for "${q}": ${body.slice(0, 200)}`);
      return res.status(502).json({ error: "Location search is temporarily unavailable." });
    }
    const raw = (await response.json()) as NominatimResult[];
    const results = raw
      .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    searchCache.set(cacheKey, { at: Date.now(), results });
    res.json(results);
  } catch (e) {
    console.error(`[geocode/search] request failed for "${q}":`, e);
    res.status(502).json({ error: "Location search is temporarily unavailable." });
  }
});

// "Use my current location" - resolves GPS coordinates back to a readable
// address, the reverse of the search above.
router.get("/geocode/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.json(null);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const response = await throttledNominatimFetch(url);
    if (!response.ok) {
      console.error(`[geocode/reverse] Nominatim ${response.status} for ${lat},${lng}`);
      return res.json(null);
    }
    const result = (await response.json()) as NominatimResult | { error?: string };
    if (!("display_name" in result)) return res.json(null);
    const parsedLat = Number(result.lat);
    const parsedLng = Number(result.lon);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return res.json(null);
    res.json({ label: result.display_name, lat: parsedLat, lng: parsedLng });
  } catch {
    res.json(null);
  }
});

export default router;
