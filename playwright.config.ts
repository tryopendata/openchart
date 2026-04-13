import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for visual regression testing.
 *
 * Screenshots a fixed set of Ladle stories and diffs them against
 * committed baselines. This is the pixel-level safety net for refactors
 * that must not change rendered output.
 *
 * Run:
 *   bun run test:visual         # compare against baselines
 *   bun run test:visual:update  # regenerate baselines
 */
export default defineConfig({
  testDir: './e2e/visual',
  snapshotDir: './e2e/visual/__screenshots__',
  // Keep strict. Any pixel drift surfaces as a failure.
  expect: {
    toHaveScreenshot: {
      // Individual pixels can drift ~2 units per channel on anti-aliased edges.
      // maxDiffPixelRatio keeps that from flagging as a failure, but we want
      // any structural change to fail. Start tight.
      maxDiffPixelRatio: 0.001,
      threshold: 0.1,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  // Run serially so the Ladle dev server and chart rendering are deterministic.
  fullyParallel: false,
  workers: 1,
  // No retries — we want flakes to be loud, not hidden.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:61000',
    viewport: { width: 1280, height: 900 },
    // Force a consistent device scale so baselines compare cleanly across machines.
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    // Ladle dev server. Port pinned so baseURL above matches.
    command: 'cd examples && BROWSER=none bunx ladle serve --port 61000',
    url: 'http://localhost:61000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
