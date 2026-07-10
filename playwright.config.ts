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
      testMatch: /stories\.spec\.ts$/,
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
    // Mobile visual regression: 390px viewport puts the story container in
    // the compact (<400px) breakpoint band. deviceScaleFactor stays 1 so
    // baselines compare across machines (same rationale as `visual`).
    {
      name: 'visual-mobile',
      testDir: './e2e/visual',
      testMatch: /stories-mobile\.spec\.ts$/,
      snapshotDir: './e2e/visual/__screenshots__',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
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
    // Mobile Chromium: catches narrow-viewport layout bugs (label collisions,
    // degenerate ticks) that the desktop project never sees.
    {
      name: 'invariants-chromium-mobile',
      testDir: './e2e/invariants',
      use: {
        ...devices['Pixel 7'],
      },
    },
    // Narrow mobile Chromium: a viewport inside the compact (<400px)
    // breakpoint band. Pixel 7 is 412px — the compact band CI would
    // otherwise never see is where the 7.9.x label drops lived.
    {
      name: 'invariants-chromium-mobile-narrow',
      testDir: './e2e/invariants',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 740 },
      },
    },
    // Mobile WebKit: Playwright's WebKit shares the engine bugs that break
    // real iOS Safari (dominant-baseline divergence, tspan getBBox). Run on
    // a macOS host for font-metric fidelity; Linux WebKit uses FreeType and
    // measures text differently.
    {
      name: 'invariants-webkit-mobile',
      testDir: './e2e/invariants',
      use: {
        ...devices['iPhone 13'],
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
