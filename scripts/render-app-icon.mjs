// The editable vector master for the Open Road icon. Render it with:
//   node scripts/render-app-icon.mjs
// Sharp is already in the pinned toolchain through Wrangler / Miniflare.
// Keep the iOS Icon Composer's full-size transparent layers: flattening them
// would lose the platform's dark/tinted appearance support.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const master = readFileSync(new URL('../assets/artwork/app-icon.svg', import.meta.url), 'utf8');
const defs = master.match(/<defs>[\s\S]*?<\/defs>/)[0];
const groups = new Map(
  [...master.matchAll(/<g id="([^"]+)">[\s\S]*?<\/g>/g)].map((match) => [match[1], match[0]]),
);
const svg = (art) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${art}</svg>`;

async function render(art, destination, size = 1024) {
  const png = await sharp(Buffer.from(art)).resize(size, size).png().toBuffer();
  writeFileSync(new URL(destination, import.meta.url), png);
}

for (const [name, art] of groups) {
  await render(svg(art), `../assets/WheelyWeather.icon/Assets/${name}.png`);
}
const darkSky = svg(groups.get('sky'))
  .replaceAll('#DE93E3', '#302348')
  .replaceAll('#F1BDF2', '#B6759D')
  .replaceAll('#FCE0EE', '#F6CAD8');
await render(darkSky, '../assets/WheelyWeather.icon/Assets/sky-dark.png');
await render(master, '../assets/images/icon.png');
await render(master, '../assets/images/favicon.png', 64);
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
const landPath = groups.get('land').match(/d="([^"]+)"/)[1];
const roadPath = groups.get('road').match(/d="([^"]+)"/)[1];
await render(
  svg(
    `<circle cx="512" cy="482" r="312" fill="white"/><path d="${landPath} ${roadPath}" fill="white" fill-rule="evenodd"/>`,
  ),
  '../assets/images/android-icon-monochrome.png',
);
console.log('Rendered the icon, iOS layers, Android layers and favicon from app-icon.svg.');
