import { expect, test } from '@playwright/test';

/**
 * Font-race regression: charts must recompile after webfonts load.
 *
 * On real iOS Safari the primary webfont (Inter via display=swap) swaps in
 * after first paint. The chart compiles against fallback metrics, then nothing
 * re-measures, so titles wrap wrong and labels collide. The fix marks the
 * container data-oc-fonts-state="pending" while the font is loading and
 * re-renders once on document.fonts.ready, bumping data-oc-render-gen.
 *
 * We fake a slow FontFaceSet BEFORE the app boots: check() reports the font
 * missing and ready stays unresolved until the test calls the exposed hook.
 * That deterministically reproduces the swap on every engine, so this runs
 * under all three invariant projects (desktop Chrome, mobile Chrome, WebKit).
 */

test('recompiles once after webfonts resolve', async ({ page }) => {
  await page.addInitScript(() => {
    let resolveReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    // Expose a hook the test drives to simulate the font swap.
    (window as unknown as { __resolveFontsReady: () => void }).__resolveFontsReady = resolveReady;

    const fakeFonts = {
      // Report every font as not-yet-loaded so the chart schedules a reload.
      check: () => false,
      ready,
      // FontFaceSet event surface the app never touches, stubbed for safety.
      add() {},
      delete() {},
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      get: () => fakeFonts,
    });
  });

  await page.goto('/?story=testing--mobile-regression--long-title-mobile&mode=preview');
  await page.waitForSelector('.oc-root svg.oc-chart');

  const root = page.locator('.oc-root');

  // Before the font resolves the chart is pending and has rendered at least once.
  await expect(root).toHaveAttribute('data-oc-fonts-state', 'pending');
  const genBefore = Number(await root.getAttribute('data-oc-render-gen'));
  expect(genBefore).toBeGreaterThanOrEqual(1);

  // Trigger the font swap.
  await page.evaluate(() => {
    (window as unknown as { __resolveFontsReady: () => void }).__resolveFontsReady();
  });

  // The chart flips to ready and recompiles (render generation advances).
  await expect(root).toHaveAttribute('data-oc-fonts-state', 'ready');
  await expect
    .poll(async () => Number(await root.getAttribute('data-oc-render-gen')))
    .toBeGreaterThan(genBefore);
});
