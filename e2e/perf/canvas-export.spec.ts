/**
 * Canvas-mode export correctness gate.
 *
 * A canvas-mode chart deliberately renders no dots, no gridlines and no
 * background into its live SVG -- the canvas owns all three. Serializing that
 * element would export an empty plot, so `doExport` re-materializes a complete
 * SVG instead. This asserts the re-materialization actually happened.
 *
 * It runs in a browser rather than happy-dom because the raster-marks path
 * round-trips the mark canvas through `toDataURL` into an `<image>`, and
 * happy-dom cannot decode an image.
 *
 * The `testing--canvas-export--canvas-export-correctness` story exports one
 * chart below `VECTOR_EXPORT_MAX_POINTS` (5,000) and one above, then writes
 * the shape of both to `#canvas-export-result`.
 *
 * Run: bunx playwright test --project=perf
 */

import { expect, test } from '@playwright/test';

/** Matches SMALL_N / LARGE_N in the story. */
const SMALL_N = 400;

interface Shape {
  bytes: number;
  circles: number;
  images: number;
  gridlines: number;
  hasBackground: boolean;
}

test('canvas-mode SVG export re-materializes the full chart', async ({ page }) => {
  await page.goto('/?mode=preview&story=testing--canvas-export--canvas-export-correctness');

  const resultEl = page.locator('#canvas-export-result');
  await resultEl.waitFor({ state: 'visible', timeout: 15_000 });

  await expect
    .poll(async () => (await resultEl.getAttribute('data-result')) ?? 'pending', {
      timeout: 20_000,
    })
    .not.toBe('pending');

  const raw = (await resultEl.getAttribute('data-result')) ?? '';
  // eslint-disable-next-line no-console
  console.log('canvas export:', raw);
  expect(raw, `export failed: ${raw}`).not.toContain('error');

  const { small, large } = JSON.parse(raw) as { small: Shape; large: Shape };

  // Below the cap: every dot comes back as a real vector circle, no raster.
  expect(small.circles).toBe(SMALL_N);
  expect(small.images).toBe(0);

  // Above it: the marks collapse to a single <image> and the vector circles
  // are gone. Emitting both would double-draw the cloud.
  expect(large.images).toBe(1);
  expect(large.circles).toBe(0);

  // Both paths must restore what the canvas was covering. These are exactly
  // the things the live SVG does not have, so they prove re-materialization
  // ran rather than the on-screen element being serialized.
  for (const shape of [small, large]) {
    expect(shape.gridlines).toBeGreaterThan(0);
    expect(shape.hasBackground).toBe(true);
    expect(shape.bytes).toBeGreaterThan(1000);
  }
});
