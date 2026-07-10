import { expect, test } from '@playwright/test';

/**
 * Mobile visual regression: pixel baselines at a 390x844 viewport (the
 * `visual-mobile` Playwright project). At this viewport the `.story-chart`
 * container renders at roughly ~358px after Ladle padding — inside the
 * compact (<400px) breakpoint band, which is where the 7.9.x dropped-label
 * bugs lived and which the desktop `visual` project (1280x900) never sees.
 *
 * Story set: all mobile-regression stories plus three canonical chart types.
 * Screenshot names carry a `-mobile` suffix so they can't collide with
 * desktop baselines in the shared snapshotDir.
 */

const stories = [
  { name: 'mr-long-title', slug: 'mobile-regression--long-title-mobile' },
  { name: 'mr-grouped-columns-labels-all', slug: 'mobile-regression--grouped-columns-labels-all' },
  { name: 'mr-grouped-bars-many-rows', slug: 'mobile-regression--grouped-bars-many-rows' },
  { name: 'mr-grouped-bars-sparse-ticks', slug: 'mobile-regression--grouped-bars-sparse-ticks' },
  { name: 'mr-one-wide-x-label', slug: 'mobile-regression--one-wide-x-label' },
  { name: 'mr-one-wide-x-label-large-ticks', slug: 'mobile-regression--one-wide-x-label-large-ticks' },
  { name: 'mr-uniform-short-x-labels', slug: 'mobile-regression--uniform-short-x-labels' },
  { name: 'mr-inline-y-title', slug: 'mobile-regression--inline-y-title' },
  { name: 'bar-vertical', slug: 'column--simple-columns' },
  { name: 'line-multi-series', slug: 'line-multiseries--gdp-growth' },
  { name: 'stacked-column', slug: 'column-stacked--energy-mix' },
];

for (const story of stories) {
  test(`visual mobile: ${story.name}`, async ({ page }) => {
    const url = `/?mode=preview&story=${encodeURIComponent(story.slug)}`;
    await page.goto(url);

    // Kill animations so enter/stagger/annotation-delay timings don't leak
    // into the screenshot. Inject before chart mount completes. Also hide
    // the Ladle dev overlays (theme picker, GitHub link) — at 390px they sit
    // over the chart's title zone and would bake dev UI into the baselines.
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
        .ladle-theme-picker, .oc-github-link { display: none !important; }
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

    await expect(chart).toHaveScreenshot(`${story.name}-mobile.png`);
  });
}
