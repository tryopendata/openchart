import { defineConfig } from '@playwright/test';

/** Exercise the deployable artifact, including WebKit and a throttled phone. */
export default defineConfig({
  testDir: './e2e/workbench',
  outputDir: './workbench-test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/workbench', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:6008',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    deviceScaleFactor: 1,
  },
  projects: [
    { name: 'studio-desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'studio-phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true }, metadata: { cpuThrottle: 4 } },
    { name: 'studio-narrow', use: { browserName: 'chromium', viewport: { width: 320, height: 740 }, hasTouch: true } },
    { name: 'studio-webkit', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    command: 'bun run build:workbench && bun run --filter @opendata-ai/examples preview:workbench',
    url: 'http://127.0.0.1:6008',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
