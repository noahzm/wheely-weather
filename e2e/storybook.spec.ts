import { expect, test } from 'playwright/test';

test.describe('Storybook web', () => {
  test('serves the manager shell', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Storybook/i);
  });

  test('renders a story in the preview iframe', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=components-primitives--collapsible-panel&viewMode=story',
    );

    const root = page.locator('#storybook-root');
    await expect(root).toBeVisible();
    await expect(root.getByText('Forecast details')).toBeVisible();
  });
});
