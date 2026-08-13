import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { autocompletePlaces, resolvePlace } from "../services/places";

const router = Router();
router.use(requireAuth);

// 11.x - live address/place autocomplete via Google Places API (New),
// proxied through the backend (mirrors how Cloudinary uploads are proxied
// rather than hit directly from the client - the API key never reaches the
// mobile app). Two-step flow: /search returns lightweight suggestions
// (label + placeId, no coordinates - Autocomplete itself doesn't return
// them), then /resolve turns a chosen suggestion into real coordinates via
// Place Details. Both steps require the client's sessionToken to land on
// the free Session Usage billing tier - see services/places.ts.
router.get("/geocode/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const sessionToken = typeof req.query.sessionToken === "string" ? req.query.sessionToken : "";
  if (q.length < 3 || !sessionToken) return res.json([]);

  try {
    const suggestions = await autocompletePlaces(q, sessionToken);
    res.json(suggestions);
  } catch {
    res.status(502).json({ error: "Location search is temporarily unavailable." });
  }
});

router.get("/geocode/resolve", async (req, res) => {
  const placeId = typeof req.query.placeId === "string" ? req.query.placeId : "";
  const sessionToken = typeof req.query.sessionToken === "string" ? req.query.sessionToken : "";
  if (!placeId || !sessionToken) return res.status(400).json({ error: "Missing place." });

  try {
    const resolved = await resolvePlace(placeId, sessionToken);
    if (!resolved) return res.status(404).json({ error: "Couldn't find coordinates for that place." });
    res.json(resolved);
  } catch {
    res.status(502).json({ error: "Location search is temporarily unavailable." });
  }
});

export default router;
