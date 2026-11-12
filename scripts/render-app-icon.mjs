// The editable vector master for the Open Road icon. Render it with:
//   node scripts/render-app-icon.mjs
// Sharp is already in the pinned toolchain through Wrangler / Miniflare.
// Keep the iOS Icon Composer's full-size transparent layers: flattening them
// would lose the platform's dark/tinted appearance support.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SIZE = 1024;
const GRAIN_STRENGTH = 9;

const master = readFileSync(new URL('../assets/artwork/app-icon.svg', import.meta.url), 'utf8');
const defs = master.match(/<defs>[\s\S]*?<\/defs>/)[0];
const groups = new Map(
  [...master.matchAll(/<g id="([^"]+)">([\s\S]*?)<\/g>\s*(?=<g id="|<\/svg>)/g)].map((match) => [
    match[1],
    `<g id="${match[1]}">${match[2]}</g>`,
  ]),
);
const svg = (art) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${defs}${art}</svg>`;

function grainSample(x, y) {
  let n = (x * 374_761_393 + y * 668_265_263) ^ 1_542_469_173;
  n = Math.imul(n ^ (n >>> 13), 1_274_126_177);
  n = n ^ (n >>> 16);
  return ((n & 0xff) / 127.5 - 1) * GRAIN_STRENGTH;
}

async function applyTonalGrain(buffer, size) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha === 0) continue;
      const luma = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
      // Preserve luminous whites and clean semi-transparent feathers; add tactile midtone tooth.
      const weight = (alpha / 255) * (1 - Math.max(0, luma - 0.85) * 4.5);
      const scale = size === 64 ? 0.5 : 1;
      const delta = grainSample(x, y) * weight * scale;
      data[idx] = Math.max(0, Math.min(255, Math.round(data[idx] + delta)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(data[idx + 1] + delta)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(data[idx + 2] + delta)));
    }
  }
  const png = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  return png;
}

const PNG_GRAINED = { compressionLevel: 9, palette: true, quality: 95 };
const PNG_CLEAN = { compressionLevel: 9 };

async function render(art, destination, { size = SIZE, grain = true, opaque = false } = {}) {
  const resized = sharp(Buffer.from(art)).resize(size, size);
  let pipeline = grain
    ? await applyTonalGrain(await resized.ensureAlpha().png().toBuffer(), size)
    : resized;
  if (opaque) {
    pipeline = pipeline.removeAlpha();
  }
  const png = await pipeline.png(grain ? PNG_GRAINED : PNG_CLEAN).toBuffer();
  writeFileSync(new URL(destination, import.meta.url), png);
}

for (const [name, art] of groups) {
  await render(svg(art), `../assets/WheelyWeather.icon/Assets/${name}.png`, {
    grain: name !== 'glow',
  });
}

const darkSky = svg(groups.get('sky'))
  .replaceAll('#C97AD6', '#1E1747')
  .replaceAll('#ECAFE8', '#9E5A93')
  .replaceAll('#FCE0EE', '#E486A8')
  .replaceAll('#FFFFFF', '#FBE1EC')
  .replaceAll('#EBDDF5', '#B57FB0')
  .replaceAll('#C9BBE0', '#5C4384');
await render(darkSky, '../assets/WheelyWeather.icon/Assets/sky-dark.png');
await render(master, '../assets/images/icon.png');
await render(master, '../assets/images/favicon.png', { size: 64 });
await render(master, '../public/apple-touch-icon.png', { size: 180, opaque: true });
await render(master, '../public/share-icon.png', { size: 512, opaque: true });
await render(svg(groups.get('sky')), '../assets/images/android-icon-background.png');
await render(
  svg(
    [...groups]
      .filter(([name]) => name !== 'sky')
      .map(([, art]) => art)
      .join(''),
  ),
  '../assets/images/android-icon-foreground.png',
);
// A single-ink silhouette for Android themed icons, with the route cut out.
const landPath = groups.get('land').match(/\bd="([^"]+)"/)[1];
const roadPath = groups.get('road').match(/\bd="([^"]+)"/)[1];
await render(
  svg(
    `<mask id="mono-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/><path d="${roadPath}" fill="black"/></mask>` +
      `<g mask="url(#mono-cut)"><circle cx="512" cy="482" r="308" fill="white"/><path d="${landPath}" fill="white"/></g>`,
  ),
  '../assets/images/android-icon-monochrome.png',
  { grain: false },
);
console.log('Rendered the icon, iOS layers, Android layers and favicon from app-icon.svg.');
