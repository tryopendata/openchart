/**
 * Canvas scatter frame-pacing gate.
 *
 * The whole point of the canvas mark layer is that a high-cardinality update
 * stays smooth. That claim is only checkable in a real browser with a real
 * compositor, so the `testing--canvas-perf--canvas-update-perf` story mounts a
 * 5,000-point canvas scatter, runs one `.update()`, samples inter-frame deltas,
 * and writes `{ frames, mean, p95 }` to `#perf-result`.
 *
 * Thresholds are deliberately CI-generous. This is a "did we regress by an
 * order of magnitude" tripwire, not a benchmark: shared CI runners are noisy,
 * and a tight bound here would flake more than it would catch. The real
 * low-end-device pass stays a manual per-release step.
 *
 * Run: bunx playwright test --project=perf
 */

import { expect, test } from '@playwright/test';

/** Roughly two dropped frames at 60fps. */
const MEAN_BUDGET_MS = 33;
/** Roughly three. Tail spikes on a shared runner are expected. */
const P95_BUDGET_MS = 50;

test('a 5,000-point canvas update holds its frame budget', async ({ page }) => {
  await page.goto('/?mode=preview&story=testing--canvas-perf--canvas-update-perf');

  const resultEl = page.locator('#perf-result');
  await resultEl.waitFor({ state: 'visible', timeout: 15_000 });

  await expect
    .poll(async () => (await resultEl.getAttribute('data-result')) ?? 'pending', {
      timeout: 20_000,
    })
    .not.toBe('pending');

  const raw = (await resultEl.getAttribute('data-result')) ?? '';
  // eslint-disable-next-line no-console
  console.log('canvas scatter perf:', raw);
  expect(raw, `perf harness failed: ${raw}`).not.toContain('error');

  const result = JSON.parse(raw) as { frames: number; mean: number; p95: number };

  // A sample too small to mean anything usually means the transition never ran
  // (gate vetoed it) -- which would make the timings trivially perfect.
  expect(result.frames, 'too few frames sampled to judge pacing').toBeGreaterThan(10);
  expect(result.mean).toBeLessThan(MEAN_BUDGET_MS);
  expect(result.p95).toBeLessThan(P95_BUDGET_MS);
});
