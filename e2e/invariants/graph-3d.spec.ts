/**
 * The 3D renderer's browser-only contracts.
 *
 * Everything here needs a real GPU-backed context, a real remount and a real
 * `WEBGL_lose_context`, none of which happen-dom can produce. No fps assertions:
 * CI Chromium is SwiftShader, 10-50x slower than a GPU, so a timing threshold
 * here would measure the runner rather than the renderer. The node gate that
 * came out of those measurements is asserted instead.
 */

import { expect, type Page, test } from '@playwright/test';

const STORY = '/?story=graphs--graphs&mode=preview';

test.beforeEach(({ browserName, isMobile }) => {
  test.skip(browserName !== 'chromium', 'WebGL under the other engines is out of scope for RFC 27');
  test.skip(Boolean(isMobile), 'RFC 27: 3D is not offered on touch in v1');
});

/**
 * Instrument WebGL context loss BEFORE any script runs.
 *
 * `destroy()` calls `_destructor()` (which detaches the canvas) and only then
 * `forceContextLoss()`, and `loseContext()` dispatches asynchronously — so by
 * the time the event fires the canvas is off the document and a delegated
 * listener would never see it. The listener has to be on the canvas itself,
 * which means catching each canvas as it is inserted.
 */
async function instrumentContextLoss(page: Page, demoId: string): Promise<void> {
  await page.addInitScript((id: string) => {
    const state = { lost: 0, destroyed3D: 0 };
    (window as unknown as { __ocGl: typeof state }).__ocGl = state;
    // Scoped to one demo on purpose. The gallery keeps several 3D demos alive
    // at once and the browser evicts contexts under its own cap, so a
    // document-wide count would be measuring other demos' churn.
    const inDemo = (el: Element): boolean => el.closest(`#${id}`) !== null;
    // One listener per canvas. The observer reports the same canvas through
    // every ancestor insertion, and each fresh closure would be a separate
    // listener, so a single loss would be counted several times.
    const seen = new WeakSet<Element>();
    const watch = (root: Node): void => {
      if (!(root instanceof Element)) return;
      const canvases = root.matches('.oc-graph-3d canvas')
        ? [root]
        : [...root.querySelectorAll('.oc-graph-3d canvas')];
      for (const c of canvases) {
        if (!inDemo(c) || seen.has(c)) continue;
        seen.add(c);
        c.addEventListener('webglcontextlost', () => state.lost++);
      }
    };
    new MutationObserver((records) => {
      for (const r of records) {
        for (const added of r.addedNodes) watch(added);
        for (const removed of r.removedNodes) {
          if (!(removed instanceof Element)) continue;
          const wasThreeD = removed.matches('.oc-graph-3d') || removed.querySelector('.oc-graph-3d');
          // `removed` is already detached, so ask its former parent instead.
          const parent = r.target instanceof Element ? r.target : null;
          if (wasThreeD && parent && inDemo(parent)) state.destroyed3D++;
        }
      }
      // `document`, not `documentElement`: an init script can run before the
      // root element exists, and `observe(null)` throws.
    }).observe(document, { childList: true, subtree: true });
  }, demoId);
}

/** Scroll a lazy-mounted demo into view and wait for its viz to appear. */
async function openDemo(page: Page, id: string, selector: string): Promise<void> {
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await page.locator(`#${id} ${selector}`).first().waitFor({ timeout: 60_000 });
}

test('a dimensions: 3 demo renders a WebGL canvas and no 2D canvas', async ({ page }) => {
  await page.goto(STORY);
  await openDemo(page, 'basic-3d', '.oc-graph-3d canvas');

  const probe = await page.evaluate(() => {
    const demo = document.querySelector('#basic-3d');
    const canvas = demo?.querySelector('.oc-graph-3d canvas') ?? null;
    if (!(canvas instanceof HTMLCanvasElement)) return { canvas: false };
    // getContext returns the EXISTING context only for the type it was created
    // with, and null for the other, so both have to be tried. three prefers
    // webgl2 and falls back to webgl1; either is a live context.
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return {
      canvas: true,
      hasContext: gl !== null,
      lost: gl !== null && gl.isContextLost(),
      twoD: demo?.querySelectorAll('.oc-graph-canvas').length ?? -1,
    };
  });

  expect(probe.canvas).toBe(true);
  expect(probe.hasContext).toBe(true);
  expect(probe.lost).toBe(false);
  // The 3D branch must not also build the Canvas renderer's surface.
  expect(probe.twoD).toBe(0);
});

test('a graph one node over the gate renders in 2D', async ({ page }) => {
  await page.goto(STORY);
  await page.locator('#over-gate-3d').scrollIntoViewIfNeeded();
  await page.locator('#over-gate-3d button', { hasText: 'Load the over-gate graph' }).click();
  await openDemo(page, 'over-gate-3d', '.oc-graph-canvas');

  expect(await page.locator('#over-gate-3d .oc-graph-canvas').count()).toBe(1);
  expect(await page.locator('#over-gate-3d .oc-graph-3d').count()).toBe(0);
});

test('toggling dimensions remounts once and releases the WebGL context', async ({ page }) => {
  // The gallery loads the 3D subpath with a dynamic import, so on a cold dev
  // server the first click pays for transforming the three.js chunk. That can
  // exceed the default 30s budget on its own and leave nothing for the second
  // toggle; the individual waits below are already generous.
  test.slow();
  await instrumentContextLoss(page, 'toggle-2d-3d');
  await page.goto(STORY);
  await openDemo(page, 'toggle-2d-3d', '.oc-graph-wrapper');

  const toggle = page.locator('#toggle-2d-3d button', { hasText: 'Switch to' });

  await toggle.click();
  await page.locator('#toggle-2d-3d .oc-graph-3d canvas').waitFor({ timeout: 60_000 });
  await toggle.click();
  await page.locator('#toggle-2d-3d .oc-graph-canvas').waitFor({ timeout: 60_000 });

  // A remount replaces the wrapper; it must never leave the old one behind.
  expect(await page.locator('#toggle-2d-3d .oc-graph-wrapper').count()).toBe(1);
  expect(await page.locator('#toggle-2d-3d .oc-graph-3d').count()).toBe(0);

  // Browsers cap live contexts at ~16, so every destroyed 3D mount has to give
  // one back. `loseContext()` dispatches asynchronously.
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const s = (window as unknown as { __ocGl: { lost: number; destroyed3D: number } }).__ocGl;
          return { lost: s.lost, destroyed: s.destroyed3D };
        }),
      { timeout: 10_000 },
    )
    .toEqual({ lost: 1, destroyed: 1 });
});
