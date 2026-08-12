import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth";
import { cloudinary } from "../services/cloudinary";

// Phone cameras routinely produce 5-15MB photos - way more resolution and
// file size than anything in this app ever needs to display. Uploads are
// held in memory just long enough to be downscaled/re-encoded with sharp,
// so what actually gets stored (and served to every other user) is a
// fraction of the size, regardless of what the original was.
//
// The processed image is uploaded to Cloudinary rather than written to
// local disk - Render's disk is wiped on every deploy/restart, which was
// silently deleting every user's uploaded photos.
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
    const processed = await sharp(req.file.buffer)
      .rotate() // apply the photo's EXIF orientation before stripping metadata
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    const publicId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "tribr", public_id: publicId, resource_type: "image" },
        (error, uploadResult) => (error || !uploadResult ? reject(error) : resolve(uploadResult))
      );
      stream.end(processed);
    });

    res.status(201).json({ url: result.secure_url });
  } catch (e: any) {
    console.error("Upload failed:", e);
    res.status(400).json({ error: "Could not process that image." });
  }
});

export default router;
