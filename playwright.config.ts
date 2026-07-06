import { defineConfig, devices } from 'playwright/test';

const STORYBOOK_URL = 'http://localhost:6006';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'storybook.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: STORYBOOK_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run storybook:web',
    url: STORYBOOK_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
