import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

// 11.x - address/place autocomplete, proxied through the backend so the
// Mapbox access token never reaches the mobile client (same reasoning as
// routing Cloudinary uploads through the backend rather than uploading
// directly from the app).
router.get("/geocode/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || !MAPBOX_TOKEN) return res.json([]);

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
    const response = await fetch(url);
    if (!response.ok) return res.json([]);
    const data = (await response.json()) as { features?: MapboxFeature[] };
    res.json((data.features ?? []).map((f) => ({ label: f.place_name, lat: f.center[1], lng: f.center[0] })));
  } catch {
    res.json([]);
  }
});

// "Use my current location" - resolves GPS coordinates back to a readable
// address, the reverse of the search above.
router.get("/geocode/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !MAPBOX_TOKEN) return res.json(null);

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return res.json(null);
    const data = (await response.json()) as { features?: MapboxFeature[] };
    const first = data.features?.[0];
    res.json(first ? { label: first.place_name, lat: first.center[1], lng: first.center[0] } : null);
  } catch {
    res.json(null);
  }
});

export default router;
