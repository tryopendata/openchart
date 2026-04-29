import { expect, test, type Page } from '@playwright/test';

/**
 * Visual regression: canonical story set.
 *
 * These 8 scenarios are the pixel-level contract for v7 refactoring.
 * If any of these screenshots drift, the refactor changed rendered output.
 *
 * Each entry targets a Ladle story by slug (path segment after `?story=`).
 * We use `?mode=preview` to hide the Ladle sidebar that would otherwise
 * compress the chart area.
 */
const stories: Array<{ name: string; slug: string; note?: string }> = [
  { name: 'bar-vertical', slug: 'column--simple-columns' },
  { name: 'bar-horizontal-gradient', slug: 'bar--simple-bars' },
  { name: 'line-multi-series', slug: 'line-multiseries--gdp-growth' },
  { name: 'stacked-column', slug: 'column-stacked--energy-mix' },
  {
    name: 'sankey-narrow-long-labels',
    slug: 'sankey--compact',
    note: '360px width with multi-word node names',
  },
  {
    name: 'pie-with-legend',
    slug: 'donut-leaders--smartphone-market',
    note: 'Closest existing story: donut with leader-line labels. OpenChart pies label slices inline rather than using an external legend by default.',
  },
  { name: 'chart-with-annotations', slug: 'column-diverging--temperature-anomaly' },
  { name: 'chart-with-watermark', slug: 'chrome--chrome-all-elements' },
  { name: 'sparklines', slug: 'sparkline--sparklines' },
];

/**
 * Strip non-deterministic SVG IDs.
 *
 * Gradients and clipPaths get generated IDs like `oc-grad-<nanoid>` that
 * change per mount. Removing them stops Playwright from diffing those bytes.
 * We leave the `url(#...)` references as-is; screenshot comparison only cares
 * about pixels, not the underlying DOM.
 */
async function stripVolatileIds(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector('.oc-chart-root, .oc-root, svg.oc-sankey, .story-chart');
    if (!root) return;
    for (const el of root.querySelectorAll('[id]')) {
      el.removeAttribute('id');
    }
  });
}

for (const story of stories) {
  test(`visual: ${story.name}`, async ({ page }) => {
    const url = `/?mode=preview&story=${encodeURIComponent(story.slug)}`;
    await page.goto(url);

    // Kill animations so enter/stagger/annotation-delay timings don't leak
    // into the screenshot. Inject before chart mount completes.
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    // Wait for the OpenChart root to appear and contain rendered content.
    const chart = page.locator('.oc-chart-root, .oc-root, svg.oc-sankey, .story-chart').first();
    await chart.waitFor({ state: 'visible', timeout: 15_000 });

    // Condition: a rendered chart has at least one <text> or mark shape inside.
    await page.waitForFunction(
      () => {
        const root = document.querySelector('.oc-chart-root, .oc-root, svg.oc-sankey, .story-chart');
        if (!root) return false;
        return (
          root.querySelector('text') !== null ||
          root.querySelector('rect, path, circle, line') !== null
        );
      },
      { timeout: 10_000 },
    );

    // Fonts stable.
    await page.evaluate(() => document.fonts?.ready);

    // One layout tick after fonts finish to settle text measurements.
    await page.waitForTimeout(100);

    await stripVolatileIds(page);

    await expect(chart).toHaveScreenshot(`${story.name}.png`);
  });
}
