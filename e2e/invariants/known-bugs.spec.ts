import { expect, test } from '@playwright/test';

/**
 * Known layout bugs that are red-locked until the resolved layout contract
 * (docs/plans/04-resolved-layout-contract.md) lands. Each test uses
 * test.fixme() so it shows as "skipped" in CI rather than failing.
 *
 * These tests need real getBBox() / getBoundingClientRect() which Playwright's
 * Chromium provides, unlike happy-dom in vitest.
 */

// Red-locked: fixed by docs/plans/04-resolved-layout-contract.md
test('rotated x-axis labels do not overlap source text', async ({ page }) => {
  test.fixme(true, 'Red-locked: fixed by docs/plans/04-resolved-layout-contract.md');
  // Navigate to the story with long category labels (auto-rotated) + source chrome.
  await page.goto('/?story=rotated-with-source--rotated-with-source&mode=preview');

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

  // The source text should not overlap the axis labels.
  expect(overlap.gap, 'source text overlaps rotated x-axis labels').toBeGreaterThanOrEqual(0);

  // The gap should be close to the theme's chartToFooter spacing (default 8px).
  // Allow 3px tolerance for rounding / sub-pixel differences.
  expect(
    Math.abs(overlap.gap - 8),
    `gap between axis labels and source should be ~8px (chartToFooter), got ${overlap.gap.toFixed(1)}px`,
  ).toBeLessThanOrEqual(3);
});
