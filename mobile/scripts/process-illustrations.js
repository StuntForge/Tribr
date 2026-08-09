// Light, non-destructive pass: just trims the mostly-empty transparent
// margin around each illustration (they're exported on a wide canvas with
// a soft glow-on-black card - only the four corners are truly transparent,
// so this doesn't remove much, but tightens the crop for consistent sizing
// in the app). See README note in the chat history: full background
// removal was attempted and reverted - flood-fill / luminance keying both
// damaged dark hair and clothing because they're tonally continuous with
// the black backdrop in this art style.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "assets", "illustrations");
const OUT_DIR = path.join(DIR, "processed");

async function processOne(file) {
  const src = path.join(DIR, file);
  const outPath = path.join(OUT_DIR, file.toLowerCase().replace(/\s+/g, "-"));
  await sharp(src).trim({ threshold: 10 }).png().toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(file, "->", path.basename(outPath), meta.width, "x", meta.height);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".png"));
  for (const f of files) await processOne(f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
