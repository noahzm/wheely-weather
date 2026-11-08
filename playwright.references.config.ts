import { defineConfig, devices } from '@playwright/test';

// Explicit regeneration only. These reviewable artifacts are not pixel-diff
// baselines, and ordinary CI/browser tests never overwrite them.
export default defineConfig({
  testDir: './e2e/visual',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/../../docs/visual-references/{arg}{ext}',
  updateSnapshots: 'all',
  use: {
    ...devices['iPhone 13'],
    browserName: 'webkit',
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'node scripts/serve-web-export.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
