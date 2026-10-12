import { defineConfig } from '@playwright/test';

/** Exercise the deployable artifact, including WebKit and a throttled phone. */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:6008${process.env.STUDIO_TEST_BASE_PATH || '/'}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'studio-desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'studio-phone',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true },
      metadata: { cpuThrottle: 4 },
    },
    {
      name: 'studio-narrow',
      use: { browserName: 'chromium', viewport: { width: 320, height: 740 }, hasTouch: true },
    },
    {
      name: 'studio-webkit',
      use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: {
    command: 'bun run build && node scripts/serve-dist.mjs',
    url: `http://127.0.0.1:6008${process.env.STUDIO_TEST_BASE_PATH || '/'}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
