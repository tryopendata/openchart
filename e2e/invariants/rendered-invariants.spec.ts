import { expect, test } from '@playwright/test';

/**
 * Layout invariant checks on real rendered charts.
 *
 * These tests use getBoundingClientRect() in Playwright's Chromium to catch
 * engine-vs-renderer disagreements that vitest can't detect because happy-dom
 * has no real getBBox/getBoundingClientRect.
 *
 * Story slugs are reused from the visual regression suite.
 */
const stories = [
  { name: 'bar-vertical', slug: 'column--simple-columns' },
  { name: 'bar-horizontal', slug: 'bar--simple-bars' },
  { name: 'line-multi-series', slug: 'line-multiseries--gdp-growth' },
  { name: 'stacked-column', slug: 'column-stacked--energy-mix' },
  { name: 'chart-with-annotations', slug: 'column-diverging--temperature-anomaly' },
  { name: 'chart-with-full-chrome', slug: 'chrome--chrome-all-elements' },
  { name: 'pie-with-legend', slug: 'donut-leaders--smartphone-market' },
  { name: 'multi-series-area-with-legend', slug: 'line--multi-series-area-overlap' },
];

for (const { name, slug } of stories) {
  test(`layout invariants: ${name}`, async ({ page }) => {
    await page.goto(`/?story=${encodeURIComponent(slug)}&mode=preview`);
    await page.waitForSelector('.oc-root');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);

    const violations = await page.evaluate(() => {
      const violations: string[] = [];
      const root = document.querySelector('.oc-root');
      if (!root) return ['no .oc-root found'];
      const svg = root.querySelector('svg.oc-chart');
      if (!svg) return ['no svg.oc-chart found'];
      const svgRect = svg.getBoundingClientRect();

      // Helper: do two rects overlap (with tolerance)?
      function overlaps(a: DOMRect, b: DOMRect, epsilon = 1): boolean {
        return (
          a.left < b.right - epsilon &&
          a.right > b.left + epsilon &&
          a.top < b.bottom - epsilon &&
          a.bottom > b.top + epsilon
        );
      }

      // Collect bounding rects for key layout elements
      const legend = svg.querySelector('.oc-legend');
      const axisX = svg.querySelector('.oc-axis.oc-axis-x');
      const source = svg.querySelector('.oc-source');
      const byline = svg.querySelector('.oc-byline');
      const title = svg.querySelector('.oc-title');
      const subtitle = svg.querySelector('.oc-subtitle');

      // Rule 1: Legend doesn't overlap x-axis labels
      if (legend && axisX) {
        const legendRect = legend.getBoundingClientRect();
        const axisRect = axisX.getBoundingClientRect();
        if (overlaps(legendRect, axisRect)) {
          violations.push(
            `legend overlaps x-axis: legend=${JSON.stringify(legendRect.toJSON())} axis=${JSON.stringify(axisRect.toJSON())}`,
          );
        }
      }

      // Rule 2: Source/byline don't overlap x-axis labels
      for (const [elName, el] of [
        ['source', source],
        ['byline', byline],
      ] as const) {
        if (el && axisX) {
          const elRect = el.getBoundingClientRect();
          const axisRect = axisX.getBoundingClientRect();
          if (overlaps(elRect, axisRect)) {
            violations.push(`${elName} overlaps x-axis`);
          }
        }
      }

      // Rule 3: Chrome elements don't overlap each other
      const chromeEls = (
        [
          ['title', title],
          ['subtitle', subtitle],
          ['source', source],
          ['byline', byline],
        ] as [string, Element | null][]
      ).filter((pair): pair is [string, Element] => pair[1] !== null);

      for (let i = 0; i < chromeEls.length; i++) {
        for (let j = i + 1; j < chromeEls.length; j++) {
          const [nameA, elA] = chromeEls[i];
          const [nameB, elB] = chromeEls[j];
          const a = elA.getBoundingClientRect();
          const b = elB.getBoundingClientRect();
          if (overlaps(a, b)) {
            violations.push(`chrome overlap: ${nameA} vs ${nameB}`);
          }
        }
      }

      // Rule 4: Legend stays within SVG bounds (2px tolerance)
      if (legend) {
        const r = legend.getBoundingClientRect();
        if (
          r.left < svgRect.left - 2 ||
          r.right > svgRect.right + 2 ||
          r.top < svgRect.top - 2 ||
          r.bottom > svgRect.bottom + 2
        ) {
          violations.push(
            `legend exceeds SVG bounds: legend=${JSON.stringify(r.toJSON())} svg=${JSON.stringify(svgRect.toJSON())}`,
          );
        }
      }

      // Rule 5: Title/subtitle stay within SVG horizontal bounds (2px tolerance)
      for (const [elName, el] of [
        ['title', title],
        ['subtitle', subtitle],
      ] as const) {
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.right > svgRect.right + 2) {
            violations.push(`${elName} overflows SVG right edge`);
          }
          if (r.left < svgRect.left - 2) {
            violations.push(`${elName} overflows SVG left edge`);
          }
        }
      }

      return violations;
    });

    expect(violations, `Layout violations in ${name}: ${violations.join('; ')}`).toEqual([]);
  });
}
