import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for e2e tests: visual regression + layout invariants.
 *
 * Run:
 *   bun run test:visual         # visual regression only
 *   bun run test:visual:update  # regenerate visual baselines
 *   bun run test:invariants     # layout invariant checks only
 */
export default defineConfig({
  // Run serially so the Ladle dev server and chart rendering are deterministic.
  fullyParallel: false,
  workers: 1,
  // No retries - we want flakes to be loud, not hidden.
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
      name: 'visual',
      testDir: './e2e/visual',
      snapshotDir: './e2e/visual/__screenshots__',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 1,
      },
      // Keep strict. Any pixel drift surfaces as a failure.
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.001,
          threshold: 0.1,
          animations: 'disabled',
          caret: 'hide',
        },
      },
    },
    {
      name: 'invariants',
      testDir: './e2e/invariants',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 1,
      },
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
