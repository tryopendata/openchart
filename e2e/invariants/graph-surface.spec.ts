/**
 * The graph canvas sits on the library's own surface token.
 *
 * Red-locked regression: `graph.css` carried a private GitHub-dark canvas
 * (`--oc-bg: #0d1117`) for dark mode, so a dark graph and a dark chart on the
 * same page were painted on two different blacks, and any theme background a
 * host set was silently overridden. The mount now stamps the resolved theme
 * surface (falling back to the mode's `--oc-bg` token when the theme background
 * is transparent), which is also the color the engine cuts node knockout rings
 * in — so this has to be checked in a real browser, where the cascade runs.
 */

import { expect, test } from '@playwright/test';

const DARK_BG = '#09090b';
const RETIRED_GRAPH_BG = '#0d1117';

test('dark graph wrapper uses the dark surface token, not a private hex', async ({ page }) => {
  await page.goto('/?story=graphs--graphs&mode=preview&theme=dark');
  await page.waitForSelector('.oc-graph-wrapper canvas');
  await page.evaluate(() => document.fonts.ready);

  const surface = await page.evaluate(() => {
    const wrapper = document.querySelector('.oc-graph-wrapper') as HTMLElement | null;
    if (!wrapper) return null;
    const cs = getComputedStyle(wrapper);
    return {
      bg: cs.getPropertyValue('--oc-bg').trim(),
      className: wrapper.className,
      painted: cs.backgroundColor,
    };
  });

  expect(surface).not.toBeNull();
  // The story is in dark mode at all (guards against a silently-light page
  // making the assertion below vacuous).
  expect(surface?.className).toContain('oc-dark');
  expect(surface?.bg.toLowerCase()).toBe(DARK_BG);
  expect(surface?.bg.toLowerCase()).not.toBe(RETIRED_GRAPH_BG);
  expect(surface?.painted).toBe('rgb(9, 9, 11)');
});
