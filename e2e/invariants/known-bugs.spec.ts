import { expect, test } from '@playwright/test';
import { waitForResizeSettled } from '../settle';
import { DEFAULT_THEME } from '../../packages/core/src/theme/defaults';

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
  await page.waitForSelector('.oc-root[data-oc-fonts-state="ready"] svg.oc-chart:not(.oc-animate)');
  await waitForResizeSettled(page.locator('.oc-root').first());

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

  // Keep the same 14px cross-engine glyph-bounds tolerance above the theme's
  // footer spacing. v8 used 8px + 14px = 22px; v9 deliberately uses 12px +
  // 14px = 26px. WebKit places the bottom of a rotated glyph several pixels
  // higher than Blink for the same reserved extent. The no-overlap bound above
  // stays strict; this upper bound still rejects a large accidental dead band.
  const maxGap = DEFAULT_THEME.spacing.chartToFooter + 14;
  expect(
    overlap.gap,
    `gap between axis labels and source should be readable (0-${maxGap}px), got ${overlap.gap.toFixed(1)}px`,
  ).toBeLessThanOrEqual(maxGap);
});
