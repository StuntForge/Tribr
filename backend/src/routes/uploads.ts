import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../middleware/auth";

const uploadDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Phone cameras routinely produce 5-15MB photos - way more resolution and
// file size than anything in this app ever needs to display. Uploads are
// held in memory just long enough to be downscaled/re-encoded with sharp,
// so what actually lands on disk (and gets served to every other user) is
// a fraction of the size, regardless of what the original was.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 80;

const router = Router();
router.use(requireAuth);

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  try {
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.jpg`;
    await sharp(req.file.buffer)
      .rotate() // apply the photo's EXIF orientation before stripping metadata
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(path.join(uploadDir, filename));

    res.status(201).json({ url: `/uploads/${filename}` });
  } catch (e: any) {
    res.status(400).json({ error: "Could not process that image." });
  }
});

export default router;
