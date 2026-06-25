import { chromium } from 'playwright';
const url = 'http://localhost:6006/iframe.html?id=components-primitives--themed-text-variants&viewMode=story';
for (const scheme of ['light','dark']) {
  const b = await chromium.launch();
  const p = await b.newPage({ colorScheme: scheme });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `/tmp/themedtext-${scheme}.png`, fullPage: true });
  await b.close();
  console.log('shot', scheme);
}
