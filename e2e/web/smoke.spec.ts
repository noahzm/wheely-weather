import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Deterministic previews need no third-party services or telemetry. Blocking
  // unexpected requests keeps the tests independent of external services.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    await (url.origin !== 'http://127.0.0.1:4173' || url.pathname.startsWith('/api/')
      ? route.abort()
      : route.continue());
  });
});

test('the production export starts and keeps the preview across tab navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?mock=ride');
  await expect(page.getByRole('heading', { name: 'Hour by hour' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Location: Mock: Ride Day/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Location: Mock: Ride Day/ })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Night riding' })).toBeVisible();
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search for a location' })).toBeVisible();
  await page.getByRole('tab', { name: 'Weather', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Location: Mock: Ride Day/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('ride settings update the forecast and persist across reloads', async ({ page }) => {
  await page.goto('/?mock=ride');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  const night = page.getByRole('switch', { name: 'Night riding' });
  await night.click();
  await expect(night).toBeChecked();
  await page.getByRole('radio', { name: '°C', exact: true }).click();
  await expect(page.getByRole('radio', { name: '°C', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Riding for: 3 hours', exact: true }).click();
  await page.getByRole('radio', { name: '1 hour', exact: true }).click();
  await page.getByRole('tab', { name: 'Weather', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /1-hour ride\. Change ride length/ }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings(?:[/?#]|$)/);
  await expect(night).toBeChecked();
  await page.reload();
  await expect(night).toBeChecked();
  await expect(page.getByRole('radio', { name: '°C', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Riding for: 1 hour', exact: true })).toBeVisible();
});

test('collapsed alerts and forecast details are absent from the accessibility tree', async ({
  page,
}) => {
  await page.goto('/?mock=alert');
  const alert = page.getByRole('button', { name: /^Severe Thunderstorm Warning/ });
  await expect(alert).toBeVisible();
  const instruction = 'Move to a sturdy shelter';
  await expect.poll(() => page.locator('body').ariaSnapshot()).not.toContain(instruction);
  await alert.click();
  await expect
    .poll(async () => {
      const snapshot = await page.locator('body').ariaSnapshot();
      return snapshot.split(instruction).length - 1;
    })
    .toBe(1);
  await alert.click();
  await expect.poll(() => page.locator('body').ariaSnapshot()).not.toContain(instruction);

  const today = page.getByRole('button', { name: /^Today:/ });
  const row = today.locator('..');
  const detailCount = async () => {
    const snapshot = await row.ariaSnapshot();
    return (snapshot.match(/gusts\s+28\s+mph/g) ?? []).length;
  };
  await expect.poll(detailCount).toBe(0);
  await today.click();
  await expect(today).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(detailCount).toBe(1);
  await today.click();
  await expect(today).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(detailCount).toBe(0);
});

test('place search requires submission and supports keyboard, button and retries', async ({
  page,
}) => {
  await page.clock.install();
  let searches = 0;
  await page.route('**/api/geocode/search?**', async (route) => {
    searches += 1;
    await route.fulfill({
      status: searches === 3 ? 429 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        searches === 3
          ? { error: 'Rate limited' }
          : [{ lat: '42.36', lon: '-71.05', address: { city: 'Boston', state: 'Massachusetts' } }],
      ),
    });
  });
  await page.goto('/?mock=ride');
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Search for a location' });
  await field.fill('Boston');
  await expect(page.getByText('Press Search to find a place.')).toBeVisible();
  // Exceed the previous 300 ms debounce to catch accidental autocomplete.
  await page.clock.runFor(500);
  expect(searches).toBe(0);
  await field.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Boston, Massachusetts', exact: true }),
  ).toBeVisible();
  await expect.poll(() => searches).toBe(1);
  await field.fill('Elsewhere');
  await field.fill('Boston');
  await expect(page.getByText('Press Search to find a place.')).toBeVisible();
  await page.clock.runFor(500);
  expect(searches).toBe(1);
  const submit = page.getByRole('button', { name: 'Search places', exact: true });
  await submit.click();
  await expect(
    page.getByRole('button', { name: 'Boston, Massachusetts', exact: true }),
  ).toBeVisible();
  await expect.poll(() => searches).toBe(2);
  await submit.click();
  await expect(page.getByText('Too many searches. Try again shortly.')).toBeVisible();
  await submit.click();
  await expect(
    page.getByRole('button', { name: 'Boston, Massachusetts', exact: true }),
  ).toBeVisible();
  await expect.poll(() => searches).toBe(4);
});

test('home ride length previews, cancels, and applies without leaving home', async ({ page }) => {
  await page.goto('/?mock=wait');
  const chip = page.getByRole('button', { name: /3-hour ride\. Change ride length/ });
  await chip.click();
  await expect(page.getByText(/^Today · /)).toBeVisible();
  await page.getByRole('radio', { name: '1 hour', exact: true }).click();
  await expect(page.getByRole('radio', { name: '1 hour', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.getByRole('radio', { name: '3 hours', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: '1 hour', exact: true }).click();
  await page.getByRole('button', { name: 'Use this ride length' }).click();
  await expect(
    page.getByRole('button', { name: /1-hour ride\. Change ride length/ }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/?\?mock=wait$/);
  await page.reload();
  await expect(
    page.getByRole('button', { name: /1-hour ride\. Change ride length/ }),
  ).toBeVisible();
});

test('hourly shortcuts return to now and the recommended ride', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-15T11:00:00') });
  await page.goto('/?mock=wait');
  const chart = page.getByRole('slider', { name: 'Hourly ride-condition chart' });
  const now = page.getByRole('button', { name: 'Now', exact: true });
  const best = page.getByRole('button', { name: 'Best ride', exact: true });
  await expect(best).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Today’s kit' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'At 2 PM' })).toBeVisible();
  const bestValue = await chart.getAttribute('aria-valuetext');
  expect(bestValue).toBeTruthy();
  await now.click();
  await expect(now).toHaveAttribute('aria-selected', 'true');
  await expect(chart).toHaveAttribute('aria-valuetext', /^Now, Bad/);
  await expect(page.getByRole('heading', { name: 'If you go at 11 AM' })).toBeVisible();
  await expect(page.getByText('Rain jacket', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Right now' })).toBeVisible();
  await best.click();
  await expect(best).toHaveAttribute('aria-selected', 'true');
  await expect(chart).toHaveAttribute('aria-valuetext', bestValue ?? '');
  await expect(page.getByRole('heading', { name: 'Today’s kit' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'At 2 PM' })).toBeVisible();
  await page.goto('/?mock=rest');
  await expect(page.getByRole('button', { name: 'Now', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Best ride', exact: true })).toHaveCount(0);
});

test('secondary current weather details expand accessibly and retain metric guidance', async ({
  page,
}) => {
  await page.goto('/?mock=ride');
  await expect(page.getByRole('button', { name: /^Temperature:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Rain Chance:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Wind:/ })).toBeVisible();
  const air = page.getByRole('button', { name: /^Air Quality:/ });
  const more = page.getByRole('button', { name: 'More weather details', exact: true });
  await expect(air).toHaveCount(0);
  await more.click();
  await expect(
    page.getByRole('button', { name: 'Fewer weather details', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(air).toBeVisible();
  await air.click();
  await expect(air).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Fewer weather details', exact: true }).click();
  await expect(air).toHaveCount(0);
  await more.click();
  await expect(air).toHaveAttribute('aria-expanded', 'false');
});

test('dry heat and heavy rain keep distinct verdict landscapes', async ({ page }) => {
  await page.goto('/?mock=heat');
  await expect(page.getByRole('heading', { name: /Location: Mock: Hot Day/ })).toBeVisible();
  await expect(page.getByTestId('verdict-scene-heat')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Best ride', exact: true })).toHaveCount(0);
  await page.goto('/?mock=rest');
  await expect(page.getByTestId('verdict-scene-rain')).toBeVisible();
});
