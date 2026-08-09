const sharp = require("sharp");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "tribr-logo-source.png");
const OUT = (name) => path.join(__dirname, "..", "assets", name);

// Key out the near-white background of the generated logo (flat colors,
// clean edges - no photo noise - so a simple luminance threshold with a
// soft falloff band is enough to avoid jagged edges).
async function removeWhiteBackground(inputBuffer) {
  const img = sharp(inputBuffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const LOW = 235; // below this: fully opaque
  const HIGH = 250; // above this: fully transparent
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const minC = Math.min(r, g, b);
    let alpha;
    if (minC <= LOW) alpha = 255;
    else if (minC >= HIGH) alpha = 0;
    else alpha = Math.round(255 * (1 - (minC - LOW) / (HIGH - LOW)));
    data[o + 3] = Math.min(data[o + 3], alpha);
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function main() {
  const srcBuffer = await sharp(SRC).toBuffer();
  const transparent = await removeWhiteBackground(srcBuffer);

  // Main icon: square, transparency removed background, trimmed and padded
  // back out to a clean 1024x1024 (iOS composites its own rounded-square
  // mask over whatever's here, so a small uniform margin looks right).
  const trimmed = await sharp(transparent).trim().toBuffer();
  await sharp(trimmed)
    .resize(940, 940, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 42, bottom: 42, left: 42, right: 42, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUT("icon.png"));

  // Android adaptive icon foreground: generous transparent padding so the
  // mark survives circle/squircle/rounded-square masks without clipping.
  await sharp(trimmed)
    .resize(620, 620, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 202, bottom: 202, left: 202, right: 202, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUT("android-icon-foreground.png"));

  // Adaptive icon background layer: solid white, matching the logo's own
  // card color so the safe-zone padding is invisible.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .png()
    .toFile(OUT("android-icon-background.png"));

  // Monochrome (Android 13+ themed icon): white silhouette on transparent,
  // derived from the foreground's alpha shape.
  const fgRaw = await sharp(OUT("android-icon-foreground.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mono = Buffer.alloc(fgRaw.data.length);
  for (let i = 0; i < fgRaw.info.width * fgRaw.info.height; i++) {
    const o = i * fgRaw.info.channels;
    mono[o] = 255;
    mono[o + 1] = 255;
    mono[o + 2] = 255;
    mono[o + 3] = fgRaw.data[o + 3];
  }
  await sharp(mono, { raw: { width: fgRaw.info.width, height: fgRaw.info.height, channels: 4 } })
    .png()
    .toFile(OUT("android-icon-monochrome.png"));

  // Splash: logo mark on transparent, sized for expo-splash-screen's
  // imageWidth to place centered on the app's cream background.
  await sharp(trimmed)
    .resize(600, 600, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUT("splash-icon.png"));

  // Favicon (web) - small, square, plain resize is fine at this size.
  await sharp(trimmed)
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUT("favicon.png"));

  console.log("Generated icon.png, android-icon-foreground.png, android-icon-background.png, android-icon-monochrome.png, splash-icon.png, favicon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
