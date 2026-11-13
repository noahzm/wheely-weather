import { expect, test } from '@playwright/test';

const scenarios = ['ride', 'maybe', 'rest', 'alert', 'wait', 'heat'] as const;
const appearances = ['light', 'dark'] as const;

for (const appearance of appearances) {
  for (const scenario of scenarios) {
    test(`${scenario} in ${appearance} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: appearance });
      // Start at a known hour and allow the clock to advance. Freezing Date
      // can strand Reanimated's clock-driven layout and chart positioning.
      await page.clock.install({ time: new Date('2026-07-15T15:00:00Z') });
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        await (url.origin === 'http://127.0.0.1:4173' && !url.pathname.startsWith('/api/')
          ? route.continue()
          : route.abort());
      });
      await page.goto(`/?mock=${scenario}`);
      await expect(page.getByRole('heading', { name: 'Hour by hour' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Location: Mock:/ })).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const chart = page.getByLabel('Hourly ride-condition chart', { exact: true });
      await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      // All home sections render in the document without scrolling; unpin the
      // floating nav wrapper from the first viewport so it sits in the bottom
      // inset at the foot of the full-page capture instead of over the chart.
      await expect(page.getByRole('button', { name: /^Today:/ })).toBeVisible();
      await page.getByRole('tablist').evaluate((tablist) => {
        if (tablist.parentElement) {
          tablist.parentElement.style.position = 'absolute';
        }
      });
      // The capture config updates files deliberately; the screenshot matcher
      // waits for two matching frames so references never record an entrance.
      await expect(page).toHaveScreenshot(`${scenario}-${appearance}.png`, {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      if (['ride', 'heat', 'rest'].includes(scenario)) {
        const heading = await page.getByRole('heading', { name: 'Hour by hour' }).boundingBox();
        if (!heading) throw new Error('Missing hourly heading for the scene crop');
        await expect(page).toHaveScreenshot(`scene-${scenario}-${appearance}.png`, {
          clip: { x: 0, y: 0, width: 390, height: Math.ceil(heading.y) - 16 },
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
        });
      }
    });
  }
}
