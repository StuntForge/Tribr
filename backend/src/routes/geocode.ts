import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// A descriptive User-Agent is required by Nominatim's usage policy (same
// header used by services/geocode.ts's single-result fallback lookup).
const USER_AGENT = "Tribr/1.0 (dev testing; contact via app)";

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
  if (!q) return res.json([]);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) return res.json([]);
    const results = (await response.json()) as NominatimResult[];
    res.json(
      results
        .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
        .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    );
  } catch {
    res.json([]);
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
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) return res.json(null);
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
