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
  { name: 'bar-vertical', slug: 'testing--fixtures--simple-columns' },
  { name: 'bar-horizontal', slug: 'testing--fixtures--simple-bars' },
  { name: 'line-multi-series', slug: 'testing--fixtures--gdp-growth' },
  { name: 'stacked-column', slug: 'testing--fixtures--energy-mix' },
  { name: 'chart-with-annotations', slug: 'testing--fixtures--temperature-anomaly' },
  { name: 'chart-with-full-chrome', slug: 'testing--fixtures--chrome-all-elements' },
  { name: 'pie-with-legend', slug: 'testing--fixtures--smartphone-market' },
  { name: 'multi-series-area-with-legend', slug: 'testing--fixtures--multi-series-area-overlap' },
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

      // Collect bounding rects for key layout elements.
      // ALL legends, not the first: a chart can key color and size at once, and
      // `querySelector` would check one and leave the other free to overlap
      // anything (which is how a size legend drawn on top of the color legend got
      // past these rules).
      const legends = [...svg.querySelectorAll('.oc-legend')];
      const axisX = svg.querySelector('.oc-axis.oc-axis-x');
      const source = svg.querySelector('.oc-source');
      const byline = svg.querySelector('.oc-byline');
      const title = svg.querySelector('.oc-title');
      const subtitle = svg.querySelector('.oc-subtitle');

      // Rule 1: No legend overlaps the x-axis labels
      if (axisX) {
        const axisRect = axisX.getBoundingClientRect();
        for (const l of legends) {
          const legendRect = l.getBoundingClientRect();
          if (overlaps(legendRect, axisRect)) {
            violations.push(
              `legend overlaps x-axis: legend=${JSON.stringify(legendRect.toJSON())} axis=${JSON.stringify(axisRect.toJSON())}`,
            );
          }
        }
      }

      // Rule 1b: Legends don't overlap each other. A bubble chart keys color and
      // size, and both used to anchor to the same right-gutter origin.
      for (let i = 0; i < legends.length; i++) {
        for (let j = i + 1; j < legends.length; j++) {
          const a = legends[i].getBoundingClientRect();
          const b = legends[j].getBoundingClientRect();
          if (overlaps(a, b)) {
            violations.push(
              `legends overlap: a=${JSON.stringify(a.toJSON())} b=${JSON.stringify(b.toJSON())}`,
            );
          }
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

      // Rule 4: Every legend stays within SVG bounds (2px tolerance)
      for (const l of legends) {
        const r = l.getBoundingClientRect();
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

/**
 * Nothing a chart renders may lay out beyond its own container box, unless
 * something between it and the container clips it.
 *
 * The bug this guards: the screen-reader data table was a `<table>` carrying the
 * visually-hidden recipe directly. `width`/`height` are MINIMUMS on a table box,
 * so the table kept its intrinsic size (measured 119x2184px in production) while
 * `clip-path` hid it — and because it is absolutely positioned, that size landed
 * in the host page's nearest scroll container as ~1900px of dead scroll space.
 *
 * `getBoundingClientRect` reports the layout box and ignores both `clip-path`
 * and `overflow`, which is what makes this detectable at all — and also why the
 * rule has to skip anything under a clipping ancestor. Content inside a clipper
 * is already contained; only the clipper's own box reaches the host page. That
 * exemption is exactly what the fix relies on, and the pre-fix table does not
 * qualify for it: it clipped its own children but nothing clipped the table.
 *
 * Scoped to HTML boxes — the sr table, overlays, controls, live regions. What
 * the SVG paints is already covered by Rules 4 and 5 above, and on a narrow
 * viewport a pie's arcs genuinely render outside .oc-root today (a separate,
 * pre-existing bug this rule is not the place to litigate).
 *
 * happy-dom has no layout and cannot check any of it.
 */
for (const { name, slug } of stories) {
  test(`chart box containment: ${name}`, async ({ page }) => {
    await page.goto(`/?story=${encodeURIComponent(slug)}&mode=preview`);
    await page.waitForSelector('.oc-root');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);

    const violations = await page.evaluate(() => {
      const violations: string[] = [];
      const root = document.querySelector('.oc-root');
      if (!root) return ['no .oc-root found'];
      const rootRect = root.getBoundingClientRect();
      const EPSILON = 2;

      const describe = (el: Element) => {
        const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class');
        return `${el.tagName.toLowerCase()}${cls ? `.${cls.trim().split(/\s+/).join('.')}` : ''}`;
      };

      /** Does an ancestor strictly between `el` and `.oc-root` clip it? */
      const isClipped = (el: Element) => {
        for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
          if (getComputedStyle(p).overflow !== 'visible') return true;
        }
        return false;
      };

      for (const el of root.querySelectorAll('*')) {
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        // Zero-area boxes carry no layout: elements parked at display:none
        // (the tooltip, the you-draw-it controls).
        if (r.width === 0 && r.height === 0) continue;
        if (isClipped(el)) continue;
        if (
          r.left < rootRect.left - EPSILON ||
          r.right > rootRect.right + EPSILON ||
          r.top < rootRect.top - EPSILON ||
          r.bottom > rootRect.bottom + EPSILON
        ) {
          violations.push(
            `${describe(el)} escapes .oc-root: ` +
              `el=${JSON.stringify(r.toJSON())} root=${JSON.stringify(rootRect.toJSON())}`,
          );
        }
      }

      // The visually-hidden boxes are the ones that reach the host page, so
      // pin their size directly rather than inferring it from the rule above.
      for (const el of root.querySelectorAll('.oc-sr-only')) {
        const r = el.getBoundingClientRect();
        if (r.width > EPSILON || r.height > EPSILON) {
          violations.push(
            `${describe(el)} is not visually hidden: ${JSON.stringify(r.toJSON())}`,
          );
        }
      }

      return violations;
    });

    expect(violations, `Containment violations in ${name}: ${violations.join('; ')}`).toEqual([]);
  });
}
