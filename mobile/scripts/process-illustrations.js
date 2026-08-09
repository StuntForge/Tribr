// The hand-supplied illustrations are exported as an opaque "glow on black"
// card (only the four rounded corners are truly transparent in the alpha
// channel). A flat luminance threshold can't safely key out that black,
// because dark hair/clothing sits at nearly the same brightness - but a
// flood fill started from the four edges, spreading only through dark
// pixels, works: it eats the connected black backdrop while leaving any
// dark region that's fully enclosed by lighter art (hair, trousers) alone.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "assets", "illustrations");
const OUT_DIR = path.join(DIR, "processed");
const DARK = 60; // luminance below this counts as "dark" for flood-fill purposes

async function floodKeyBackground(inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    lum[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }

  const isBg = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qHead = 0, qTail = 0;

  const tryPush = (idx) => {
    if (!visited[idx] && lum[idx] < DARK) {
      visited[idx] = 1;
      isBg[idx] = 1;
      queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % width, y = (idx / width) | 0;
    if (x > 0) tryPush(idx - 1);
    if (x < width - 1) tryPush(idx + 1);
    if (y > 0) tryPush(idx - width);
    if (y < height - 1) tryPush(idx + width);
  }

  for (let i = 0; i < width * height; i++) {
    if (isBg[i]) data[i * channels + 3] = 0;
  }
  return { data, info };
}

async function processOne(file) {
  const src = path.join(DIR, file);
  const { data, info } = await floodKeyBackground(src);
  const keyed = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  const trimmed = await keyed.png().trim({ threshold: 10 }).toBuffer();

  const outPath = path.join(OUT_DIR, file.toLowerCase().replace(/\s+/g, "-"));
  await sharp(trimmed).png({ compressionLevel: 9, palette: true, quality: 92 }).toFile(outPath);
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
