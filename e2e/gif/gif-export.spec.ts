/**
 * GIF export correctness gate.
 *
 * happy-dom can't rasterize a canvas, so the real "does it actually animate"
 * check has to run in a browser. The `testing-gif-export--gif-correctness`
 * story mounts an animated bar chart, exports a GIF via `chart.export('gif')`,
 * decodes its frame structure, and writes the result to `#gif-result`. This
 * spec reads that and asserts:
 *   1. the GIF has more than one frame (animated, not a static still), and
 *   2. an early frame's compressed bytes differ from the final frame's.
 *
 * That second assertion is the one the rejected "serialize the live CSS
 * animation" approach would have failed silently (identical frames every time).
 *
 * Run: bunx playwright test --project=gif
 */

import { expect, test } from '@playwright/test';

test('exportGIF produces a multi-frame GIF whose frames differ', async ({ page }) => {
  await page.goto('/?mode=preview&story=testing--gif-export--gif-correctness');

  const resultEl = page.locator('#gif-result');
  await resultEl.waitFor({ state: 'visible', timeout: 15_000 });

  // Poll until the async export completes (data-result stops being "pending").
  await expect
    .poll(async () => (await resultEl.getAttribute('data-result')) ?? 'pending', {
      timeout: 20_000,
    })
    .not.toBe('pending');

  const raw = (await resultEl.getAttribute('data-result')) ?? '';
  // eslint-disable-next-line no-console
  console.log('GIF correctness:', raw);
  expect(raw, `export failed: ${raw}`).not.toContain('error');

  const result = JSON.parse(raw) as {
    byteLength: number;
    frames: number;
    earlyDiffersFromLast: boolean;
  };
  expect(result.byteLength).toBeGreaterThan(100);
  expect(result.frames).toBeGreaterThan(1);
  expect(result.earlyDiffersFromLast).toBe(true);
});
