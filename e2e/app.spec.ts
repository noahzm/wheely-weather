import { expect, test } from 'playwright/test';

test.describe('Wheely Weather web app', () => {
  test('loads home with mock forecast', async ({ page }) => {
    await page.goto('/?mock=ride');
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
    await expect(page.getByText('Hour by hour')).toBeVisible({ timeout: 15_000 });
  });

  test('navigates between tabs', async ({ page }) => {
    await page.goto('/?mock=ride');
    await expect(page.getByText('Hour by hour')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'Search' }).click();
    await expect(page.getByRole('textbox', { name: 'Search for a location' })).toBeVisible();
    await expect(page.getByText('Search', { exact: true }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByText('Gear')).toBeVisible();
    await expect(page.getByText('Settings', { exact: true }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(page.getByText('Hour by hour')).toBeVisible();
  });

  test('appearance toggle updates document color scheme', async ({ page }) => {
    await page.goto('/settings?mock=ride');
    await expect(page.getByText('Appearance')).toBeVisible({ timeout: 15_000 });

    await page.getByText('Dark').click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.style.colorScheme))
      .toBe('dark');

    await page.getByText('Light').click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.style.colorScheme))
      .toBe('light');
  });
});
