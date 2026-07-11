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
 *   5. Horizontal bar marks stay above a readable-thickness floor (opt-in).
 *   6. Expected band tick labels are present — none silently dropped (opt-in).
 *   7. Legend entries clear y-axis tick labels — no box intersection (opt-in).
 */

interface StoryCase {
  name: string;
  slug: string;
  /** Which axis is quantitative, for the min-tick rule. */
  quantAxis: 'x' | 'y';
  /**
   * Minimum readable thickness (px) for horizontal bar marks. When set, Rule 5
   * asserts every rendered bar is at least this tall on narrow viewports, where
   * the engine reclaims band whitespace to keep grouped bars legible. Matches
   * MIN_GROUPED_BAR_THICKNESS in the engine (tied to fontSize-10 value labels).
   */
  minBarThickness?: number;
  /**
   * Rule 6: band tick labels that must be present. The 7.9.x saga's bug class
   * was a silently DROPPED label — a chart missing "2025" passes Rules 1-5.
   * When set, every string here must appear among the visible x tick labels.
   */
  expectedXTickLabels?: string[];
  /**
   * Rule 7: no `.oc-legend-entry` box may intersect a `.oc-axis-y
   * .oc-axis-tick` label box. Bug B of the mobile-chrome-height fix: the
   * margin stack reserved the inline-tick overhang above chartArea.y, but
   * placeLegend anchored the top legend flush at chartArea.y — inside that
   * zone — so the topmost inline tick label overlapped the legend's bottom
   * row by ~5px. Opt-in for stories with inline y ticks.
   */
  checkLegendTickClearance?: boolean;
  /**
   * Playwright projects where this story currently violates a rule — a real,
   * known rendering bug or platform limitation that predates the project
   * matrix. Marked with test.fail() so it stays visible and flips to
   * "unexpected pass" (prompting removal from this list) once fixed. When
   * `platform` is set, the expected failure applies only on that OS and the
   * story is still asserted normally everywhere else.
   */
  knownFailures?: { project: string; platform?: NodeJS.Platform }[];
}

// Every new `mobile-regression` story gets an entry here.
const stories: StoryCase[] = [
  { name: 'long-wrapped-title', slug: 'testing--mobile-regression--long-title-mobile', quantAxis: 'y' },
  {
    name: 'grouped-columns-labels-all',
    slug: 'testing--mobile-regression--grouped-columns-labels-all',
    quantAxis: 'y',
  },
  {
    name: 'grouped-bars-many-rows',
    slug: 'testing--mobile-regression--grouped-bars-many-rows',
    quantAxis: 'x',
    minBarThickness: 8,
  },
  {
    name: 'grouped-bars-sparse-ticks',
    slug: 'testing--mobile-regression--grouped-bars-sparse-ticks',
    quantAxis: 'x',
    // On Linux at 412px, inside-bar value labels overlap by ~2.5px (Rule 2):
    // estimateTextWidth (engine charts/bar/labels.ts) is calibrated against
    // macOS-ish fonts and Liberation digits render wider. Passes on darwin
    // and on the 360px project. Deliberately NOT fixed by loosening the
    // overlap epsilon; needs a font-metric-aware calibration.
    knownFailures: [{ project: 'invariants-chromium-mobile', platform: 'linux' }],
  },
  {
    name: 'rotated-with-source',
    slug: 'testing--fixtures--rotated-with-source',
    quantAxis: 'y',
    // At 360px the rotated "Information Technology" tick label extends
    // ~11px left of the container (Rule 1). Pre-existing engine bug in the
    // compact band, exposed when the narrow project was added: the left
    // gutter doesn't reserve the leading rotated label's horizontal overhang.
    knownFailures: [{ project: 'invariants-chromium-mobile-narrow' }],
  },
  { name: 'chrome-all-elements', slug: 'testing--fixtures--chrome-all-elements', quantAxis: 'y' },
  {
    name: 'one-wide-x-label',
    slug: 'testing--mobile-regression--one-wide-x-label',
    quantAxis: 'y',
    expectedXTickLabels: ['2022', '2023', '2024', '2025', '2026 (to wk 17)'],
  },
  {
    // The production measles repro: axisTick 14 theme. This exact config
    // shipped broken three times (7.9.0-7.9.2) because only default-theme
    // tests existed. All five labels must render (at -45°).
    name: 'one-wide-x-label-large-ticks',
    slug: 'testing--mobile-regression--one-wide-x-label-large-ticks',
    quantAxis: 'y',
    expectedXTickLabels: ['2022', '2023', '2024', '2025', '2026 (to wk 17)'],
  },
  {
    name: 'uniform-short-x-labels',
    slug: 'testing--mobile-regression--uniform-short-x-labels',
    quantAxis: 'y',
    expectedXTickLabels: ['0-79%', '80-84%', '85-89%', '90-94%', '95-100%'],
  },
  {
    name: 'inline-y-title',
    slug: 'testing--mobile-regression--inline-y-title',
    quantAxis: 'y',
    checkLegendTickClearance: true,
  },
  {
    // Auto-height container + 4-line title + top legend + inline y ticks:
    // the only e2e coverage for the auto-height growth contract (Bug A) and
    // the Bug B legend/tick collision. Also screenshotted in
    // e2e/visual/stories-mobile.spec.ts.
    name: 'auto-height-chrome-growth',
    slug: 'testing--mobile-regression--auto-height-chrome-growth',
    quantAxis: 'y',
    checkLegendTickClearance: true,
  },
];

for (const {
  name,
  slug,
  quantAxis,
  minBarThickness,
  expectedXTickLabels,
  checkLegendTickClearance,
  knownFailures,
} of stories) {
  test(`mobile invariants: ${name}`, async ({ page }) => {
    test.fail(
      knownFailures?.some(
        (k) =>
          k.project === test.info().project.name &&
          (!k.platform || k.platform === process.platform),
      ) ?? false,
      'known rendering bug on this project — see the story entry comment',
    );
    await page.goto(`/?story=${encodeURIComponent(slug)}&mode=preview`);
    await page.waitForSelector('.oc-root svg.oc-chart');
    // Wait on explicit render-state signals instead of a blind sleep:
    // data-oc-fonts-state='ready' means the post-font recompile ran (deferred
    // until after the entrance animation, so this also covers the animated
    // path), and :not(.oc-animate) means any entrance animation finished
    // (immediate for charts that don't animate or have a cached font).
    await page.waitForSelector('.oc-root[data-oc-fonts-state="ready"]');
    await page.waitForSelector('.oc-root svg.oc-chart:not(.oc-animate)');

    const violations = await page.evaluate(({ quantAxisArg, minBarThicknessArg, expectedXTickLabelsArg, checkLegendTickClearanceArg }) => {
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

      // Rule 5: horizontal bar marks stay above the readable-thickness floor on
      // narrow viewports. Only asserted where the engine's whitespace-reclaim
      // applies (plot narrower than NARROW_VIEWPORT_MAX); on wide/desktop plots
      // the reclaim is intentionally skipped, so the desktop project skips this.
      if (minBarThicknessArg != null && window.innerWidth < 500) {
        const barRects = Array.from(svg.querySelectorAll('.oc-mark-rect rect'));
        for (const rect of barRects) {
          const h = rect.getBoundingClientRect().height;
          // Ignore zero-height (hidden) rects; assert on visible bars only.
          if (h > 0 && h < minBarThicknessArg - 0.5) {
            violations.push(
              `bar mark too thin: ${h.toFixed(1)}px < ${minBarThicknessArg}px floor`,
            );
          }
        }
      }

      // Rule 6: no band label silently dropped. Exact match on purpose: band
      // tick labels are never ellipsis-truncated today, and a tolerant prefix
      // check could let a dropped label hide behind a similar neighbor. If
      // tick truncation is ever introduced, revisit this comparison.
      if (expectedXTickLabelsArg) {
        const rendered = Array.from(svg.querySelectorAll('.oc-axis-x .oc-axis-tick'))
          .map((el) => (el.textContent ?? '').trim())
          .filter((t) => t.length > 0);
        for (const expected of expectedXTickLabelsArg) {
          if (!rendered.includes(expected)) {
            violations.push(
              `expected x tick label missing: "${expected}" (rendered: ${rendered.join(', ')})`,
            );
          }
        }
      }

      // Rule 7: legend entries clear y-axis tick labels. Inline y ticks draw
      // above their gridline, inside the top margin's reserved overhang; a
      // top legend placed flush at chartArea.y sits in that same zone and
      // collides with the topmost tick label. 2px epsilon: WebKit reports
      // wider text extents than Chromium (documented in vanilla
      // svg-renderer.ts), so sub-2px box kissing is not a real overlap.
      if (checkLegendTickClearanceArg) {
        const CLEARANCE_EPSILON = 2;
        const entries = Array.from(svg.querySelectorAll('.oc-legend .oc-legend-entry'));
        const yTicks = Array.from(svg.querySelectorAll('.oc-axis-y .oc-axis-tick'));
        for (const entry of entries) {
          const a = entry.getBoundingClientRect();
          for (const tick of yTicks) {
            const b = tick.getBoundingClientRect();
            const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (xOverlap > CLEARANCE_EPSILON && yOverlap > CLEARANCE_EPSILON) {
              violations.push(
                `legend entry overlaps y tick label (${xOverlap.toFixed(1)}x${yOverlap.toFixed(1)}px): ${describe(entry)} vs ${describe(tick)}`,
              );
            }
          }
        }
      }

      return violations;
    }, {
      quantAxisArg: quantAxis,
      minBarThicknessArg: minBarThickness,
      expectedXTickLabelsArg: expectedXTickLabels,
      checkLegendTickClearanceArg: checkLegendTickClearance,
    });

    expect(violations, violations.join('\n')).toEqual([]);
  });
}
