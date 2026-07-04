import { expect, test } from '@playwright/test';

/**
 * Geometry invariants that must hold at every viewport and in every engine.
 *
 * Motivated by real-device iOS Safari breakage (labs.tryopendata.ai, July
 * 2026): titles clipped above the container, value labels colliding, rotated
 * ticks invading the source line, and quantitative axes degenerating to a
 * single tick. Chrome desktop emulation misses most of these, so this file
 * runs across the desktop Chrome, mobile Chrome, and mobile WebKit projects.
 *
 * Rules:
 *   1. Every rendered SVG text node stays inside the .oc-root container box.
 *   2. No two visible value labels (.oc-mark-label) overlap.
 *   3. X-axis tick labels stay above the source line.
 *   4. A quantitative axis renders at least 2 tick labels.
 */

interface StoryCase {
  name: string;
  slug: string;
  /** Which axis is quantitative, for the min-tick rule. */
  quantAxis: 'x' | 'y';
}

const stories: StoryCase[] = [
  { name: 'long-wrapped-title', slug: 'mobile-regression--long-title-mobile', quantAxis: 'y' },
  {
    name: 'grouped-columns-labels-all',
    slug: 'mobile-regression--grouped-columns-labels-all',
    quantAxis: 'y',
  },
  {
    name: 'grouped-bars-many-rows',
    slug: 'mobile-regression--grouped-bars-many-rows',
    quantAxis: 'x',
  },
  {
    name: 'grouped-bars-sparse-ticks',
    slug: 'mobile-regression--grouped-bars-sparse-ticks',
    quantAxis: 'x',
  },
  { name: 'rotated-with-source', slug: 'rotated-with-source--rotated-with-source', quantAxis: 'y' },
  { name: 'chrome-all-elements', slug: 'chrome--chrome-all-elements', quantAxis: 'y' },
];

for (const { name, slug, quantAxis } of stories) {
  test(`mobile invariants: ${name}`, async ({ page }) => {
    await page.goto(`/?story=${encodeURIComponent(slug)}&mode=preview`);
    await page.waitForSelector('.oc-root svg.oc-chart');
    await page.evaluate(() => document.fonts.ready);
    // Let entrance animation and any post-font relayout settle.
    await page.waitForTimeout(600);

    const violations = await page.evaluate((quantAxisArg) => {
      const violations: string[] = [];
      const root = document.querySelector('.oc-root');
      const svg = root?.querySelector('svg.oc-chart');
      if (!root || !svg) return ['no .oc-root / svg.oc-chart found'];

      const rootRect = root.getBoundingClientRect();
      const TOLERANCE = 1.5;

      function describe(el: Element): string {
        const cls = el.getAttribute('class') ?? el.tagName;
        const text = (el.textContent ?? '').slice(0, 40);
        return `<${cls}> "${text}"`;
      }

      // Rule 1: every text node inside the container box.
      for (const textEl of svg.querySelectorAll('text')) {
        // Skip elements hidden via visibility/display or zero-size.
        const r = textEl.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.top < rootRect.top - TOLERANCE) {
          violations.push(
            `text extends ${(rootRect.top - r.top).toFixed(1)}px above container: ${describe(textEl)}`,
          );
        }
        if (r.bottom > rootRect.bottom + TOLERANCE) {
          violations.push(
            `text extends ${(r.bottom - rootRect.bottom).toFixed(1)}px below container: ${describe(textEl)}`,
          );
        }
        if (r.left < rootRect.left - TOLERANCE) {
          violations.push(
            `text extends ${(rootRect.left - r.left).toFixed(1)}px left of container: ${describe(textEl)}`,
          );
        }
        if (r.right > rootRect.right + TOLERANCE) {
          violations.push(
            `text extends ${(r.right - rootRect.right).toFixed(1)}px right of container: ${describe(textEl)}`,
          );
        }
      }

      // Rule 2: visible value labels don't overlap each other.
      const labels = Array.from(svg.querySelectorAll('.oc-mark-label')).map((el) => ({
        el,
        rect: el.getBoundingClientRect(),
      }));
      const OVERLAP_EPSILON = 2; // allow sub-2px kissing
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i].rect;
          const b = labels[j].rect;
          const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (xOverlap > OVERLAP_EPSILON && yOverlap > OVERLAP_EPSILON) {
            violations.push(
              `value labels overlap (${xOverlap.toFixed(1)}x${yOverlap.toFixed(1)}px): ${describe(labels[i].el)} vs ${describe(labels[j].el)}`,
            );
          }
        }
      }

      // Rule 3: x-axis tick labels stay above the source line.
      const source = svg.querySelector('.oc-source');
      if (source) {
        const sourceTop = source.getBoundingClientRect().top;
        let maxTickBottom = -Infinity;
        for (const tick of svg.querySelectorAll('.oc-axis-x .oc-axis-tick')) {
          const r = tick.getBoundingClientRect();
          if (r.bottom > maxTickBottom) maxTickBottom = r.bottom;
        }
        if (maxTickBottom > sourceTop + 1) {
          violations.push(
            `x-axis ticks overlap source text by ${(maxTickBottom - sourceTop).toFixed(1)}px`,
          );
        }
      }

      // Rule 4: quantitative axis renders at least 2 ticks.
      const quantTicks = svg.querySelectorAll(
        `.oc-axis-${quantAxisArg} .oc-axis-tick`,
      );
      if (quantTicks.length < 2) {
        violations.push(
          `quantitative ${quantAxisArg}-axis has ${quantTicks.length} tick(s), expected >= 2`,
        );
      }

      return violations;
    }, quantAxis);

    expect(violations, violations.join('\n')).toEqual([]);
  });
}
