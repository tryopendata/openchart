import { expect, type Page } from '@playwright/test';

/**
 * Shared screenshot harness for the visual and visual-mobile specs. Keeping
 * the wait conditions and dev-overlay hiding in one place means a fix applied
 * for one viewport can't silently weaken the other's baselines.
 */
export async function captureStory(page: Page, slug: string, screenshotName: string) {
  await page.goto(`/?mode=preview&story=${encodeURIComponent(slug)}`);

  // Kill animations so enter/stagger/annotation-delay timings don't leak
  // into the screenshot. Inject before chart mount completes. Also hide the
  // Ladle dev overlays (theme picker, GitHub link) so they can't bake dev UI
  // into baselines — at mobile widths they sit over the chart's title zone.
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

  await expect(chart).toHaveScreenshot(screenshotName);
}
