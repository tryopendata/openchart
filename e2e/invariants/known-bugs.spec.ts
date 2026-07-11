import { expect, test } from '@playwright/test';

/**
 * Layout invariants that were once red-locked bugs and are now fixed.
 *
 * The rotated x-axis / source overlap is fixed by the rotated-label extent
 * math: the layout planner reserves textWidth*|sin θ| + lineHeight*|cos θ|
 * for auto-rotated band ticks (packages/engine/src/layout/plan.ts and
 * packages/core/src/responsive/metrics.ts) so the tick footprint no longer
 * spills into the source line below.
 *
 * These tests need real getBBox() / getBoundingClientRect() which Playwright's
 * Chromium provides, unlike happy-dom in vitest.
 */

test('rotated x-axis labels do not overlap source text', async ({ page }) => {
  // Navigate to the story with long category labels (auto-rotated) + source chrome.
  await page.goto('/?story=testing--fixtures--rotated-with-source&mode=preview');

  // Wait for the chart to render.
  await page.waitForSelector('.oc-root');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);

  const overlap = await page.evaluate(() => {
    // Collect bounding rects for all x-axis tick labels.
    const tickEls = document.querySelectorAll('.oc-axis.oc-axis-x .oc-axis-tick');
    if (tickEls.length === 0) return { error: 'no tick labels found' };

    let axisBottom = -Infinity;
    for (const el of tickEls) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > axisBottom) axisBottom = rect.bottom;
    }

    // Get the source element's bounding rect.
    const sourceEl = document.querySelector('.oc-source');
    if (!sourceEl) return { error: 'no source element found' };
    const sourceRect = sourceEl.getBoundingClientRect();

    return {
      axisBottom,
      sourceTop: sourceRect.top,
      gap: sourceRect.top - axisBottom,
    };
  });

  // Bail with a clear message if elements weren't found.
  if ('error' in overlap) {
    throw new Error(`DOM query failed: ${overlap.error}`);
  }

  // Primary invariant: the source text must never overlap the axis labels.
  expect(overlap.gap, 'source text overlaps rotated x-axis labels').toBeGreaterThanOrEqual(0);

  // Secondary: the gap should stay a sane, readable size — roughly the theme's
  // chartToFooter spacing (default 8px) without a large dead band. The exact
  // value drifts by engine: Blink and WebKit place the bottom edge of a -45°
  // rotated glyph several pixels apart for the same layout, so we bound the
  // gap to a range that fits every engine (Chrome desktop ~3px, mobile WebKit
  // ~19px) rather than pinning it to a tight window it can't hold. The bottom
  // extent now reserves space from the real canvas-measured label width (axes
  // and planner agree on the measurer), which on WebKit-mobile measures the
  // rotated labels a few pixels wider than the old heuristic — a slightly more
  // conservative reservation, never an overlap.
  expect(
    overlap.gap,
    `gap between axis labels and source should be readable (0-22px), got ${overlap.gap.toFixed(1)}px`,
  ).toBeLessThanOrEqual(22);
});
