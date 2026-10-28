// Renders the iOS launch screen images: the home scene's fair-day sky as it
// stands at frame 0 of its entrance, before the hills, sun and clouds come in.
// The app opens on the same sky, so the launch screen hands off to the home
// screen without a visible cut.
//
//   node scripts/render-launch-sky.mjs
//
// Writes assets/images/launch-sky.png (light) and launch-sky-dark.png (dark),
// which app.json's expo-splash-screen plugin shows full screen on iOS.
// Re-run it after changing the sky's colors (SceneColors in theme.ts), the
// page colors (WheelyTheme) or the scene's geometry (home-backdrop.tsx).
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

// The screen it's drawn for: an iPhone 17/18 Pro (402 x 874 pt at 3x). Other
// iPhones scale it to fill; the sky is a soft gradient, so a few points of
// drift between devices don't show.
const WIDTH_PT = 402;
const HEIGHT_PT = 874;
const SCALE = 3;

// SceneColors.skyTop, .sky and .skyHorizon, and the page backgrounds.
const SKY_TOP = '#DE93E3';
const SKY = '#F1BDF2';
const SKY_HORIZON = '#FCE0EE';
const PAGES = { light: '#F4F4F6', dark: '#000000' };

// Where the home screen draws its sky on that iPhone, in points from the top:
// the scroll content starts under the large title at about 158, and the
// verdict card's top sits at about 208. The sky's gradient runs SKY_DEPTH (240)
// up from the horizon, HORIZON (34) below the content's top; the page fade runs
// from 24 to 176 below the card's top (home-backdrop.tsx).
const CONTENT_TOP = 158;
const CARD_TOP = 208;
const SKY_END = CONTENT_TOP + 34;
const SKY_START = SKY_END - 240;
const FADE_START = CARD_TOP + 24;
const FADE_END = CARD_TOP + 176;

// The film grain: assets/images/scene-grain@2x.png tiled at 128 pt, at the
// scene's GRAIN_OPACITY, starting where the scene's top lands (900 pt above
// the content's top).
const GRAIN_TILE_PT = 128;
const GRAIN_OPACITY = 0.32;
const GRAIN_ORIGIN_Y = CONTENT_TOP - 900;

function hex(color) {
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** The sky's color at a height, as the scene's three-stop SVG gradient draws it. */
function skyAt(yPt) {
  const t = clamp01((yPt - SKY_START) / (SKY_END - SKY_START));
  return t < 0.5
    ? mix(hex(SKY_TOP), hex(SKY), t / 0.5)
    : mix(hex(SKY), hex(SKY_HORIZON), (t - 0.5) / 0.5);
}

/** PNG's Paeth predictor: whichever neighbor is closest to left + up - upLeft. */
function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

/** What a scanline filter adds back to a byte, from its already-decoded neighbors. */
function predictor(filter, left, up, upLeft) {
  switch (filter) {
    case 1: {
      return left;
    }
    case 2: {
      return up;
    }
    case 3: {
      return (left + up) >> 1;
    }
    case 4: {
      return paeth(left, up, upLeft);
    }
    default: {
      return 0;
    }
  }
}

/** The IHDR size and the joined IDAT data of a PNG. */
function readPngChunks(path) {
  const data = readFileSync(path);
  let offset = 8;
  const header = { width: 0, height: 0 };
  const idat = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header.width = body.readUInt32BE(0);
      header.height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 4 || body[12] !== 0) {
        throw new Error(`${path}: expected an 8-bit, non-interlaced gray+alpha PNG`);
      }
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  return { ...header, raw: inflateSync(Buffer.concat(idat)) };
}

/** Decodes an 8-bit, non-interlaced gray+alpha PNG (the grain tile's format). */
function readGrayAlphaPng(path) {
  const { width, height, raw } = readPngChunks(path);
  const bpp = 2;
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);
  const decoded = (x, y) => (x >= 0 && y >= 0 ? pixels[y * stride + x] : 0);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const add = predictor(
        filter,
        decoded(x - bpp, y),
        decoded(x, y - 1),
        decoded(x - bpp, y - 1),
      );
      pixels[y * stride + x] = (value + add) & 255;
    }
  }
  return { width, height, pixels };
}

/** The grain's gray and alpha (0–1) at a point, sampled bilinearly from the repeating tile. */
function grainAt(grain, xPt, yPt) {
  const scale = grain.width / GRAIN_TILE_PT;
  const u = (((xPt * scale - 0.5) % grain.width) + grain.width) % grain.width;
  const v = ((((yPt - GRAIN_ORIGIN_Y) * scale - 0.5) % grain.height) + grain.height) % grain.height;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const at = (x, y, channel) =>
    grain.pixels[((y % grain.height) * grain.width + (x % grain.width)) * 2 + channel];
  const sample = (channel) => {
    const top = at(x0, y0, channel) * (1 - fx) + at(x0 + 1, y0, channel) * fx;
    const bottom = at(x0, y0 + 1, channel) * (1 - fx) + at(x0 + 1, y0 + 1, channel) * fx;
    return (top * (1 - fy) + bottom * fy) / 255;
  };
  return { gray: sample(0) * 255, alpha: sample(1) };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xff_ff_ff_ff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xff_ff_ff_ff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** Encodes 8-bit RGB pixels as a PNG, each row Sub-filtered (the gradient compresses well that way). */
function writeRgbPng(path, width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= 3 ? rgb[y * stride + x - 3] : 0;
      raw[y * (stride + 1) + 1 + x] = (rgb[y * stride + x] - left) & 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

const grain = readGrayAlphaPng(new URL('../assets/images/scene-grain@2x.png', import.meta.url));
const width = WIDTH_PT * SCALE;
const height = HEIGHT_PT * SCALE;

for (const [scheme, pageColor] of Object.entries(PAGES)) {
  const page = hex(pageColor);
  const rgb = Buffer.alloc(width * height * 3);
  for (let py = 0; py < height; py++) {
    const yPt = (py + 0.5) / SCALE;
    const fade = clamp01((yPt - FADE_START) / (FADE_END - FADE_START));
    const sky = skyAt(yPt);
    for (let px = 0; px < width; px++) {
      let color = sky;
      // Below the fade the scene is gone: plain page, no grain.
      if (fade < 1) {
        const { gray, alpha } = grainAt(grain, (px + 0.5) / SCALE, yPt);
        const g = alpha * GRAIN_OPACITY;
        color = color.map((v) => v * (1 - g) + gray * g);
      }
      color = mix(color, page, fade);
      const i = (py * width + px) * 3;
      rgb[i] = Math.round(color[0]);
      rgb[i + 1] = Math.round(color[1]);
      rgb[i + 2] = Math.round(color[2]);
    }
  }
  const name = scheme === 'light' ? 'launch-sky.png' : 'launch-sky-dark.png';
  const bytes = writeRgbPng(
    new URL(`../assets/images/${name}`, import.meta.url),
    width,
    height,
    rgb,
  );
  console.log(`${name}: ${width}x${height}, ${Math.round(bytes / 1024)} KB`);
}
