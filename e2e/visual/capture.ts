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
  const chart = page
    .locator('.oc-chart-root, .oc-root, svg.oc-sankey, .story-chart, .tfix-chart')
    .first();
  await chart.waitFor({ state: 'visible', timeout: 15_000 });

  // Condition: a rendered chart has at least one <text> or mark shape inside.
  await page.waitForFunction(
    () => {
      const root = document.querySelector(
        '.oc-chart-root, .oc-root, svg.oc-sankey, .story-chart, .tfix-chart',
      );
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

  // Canvas mark mode paints on a rAF tick the injected stylesheet cannot
  // reach, and the SVG-child wait above passes while the canvas is still
  // blank. If the story mounts a mark canvas, wait for its first real paint
  // (the background lands in the same pass as gridlines and dots), then give
  // the scheduler two frames to settle.
  if ((await page.locator('canvas.oc-mark-canvas').count()) > 0) {
    await page.waitForFunction(
      () => {
        const c = document.querySelector('canvas.oc-mark-canvas') as HTMLCanvasElement | null;
        const ctx = c?.getContext('2d');
        if (!c || !ctx || c.width === 0 || c.height === 0) return false;
        // Sample the vertical centre: the canvas only paints the plot region,
        // so the top rows (chrome zone) stay transparent forever.
        const { data } = ctx.getImageData(0, Math.floor(c.height / 2), c.width, 1);
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
        return false;
      },
      { timeout: 10_000 },
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
        ),
    );
  }

  // One layout tick after fonts finish to settle text measurements.
  await page.waitForTimeout(100);

  await expect(chart).toHaveScreenshot(screenshotName);
}
