/**
 * Development-time WCAG contrast diagnostics.
 *
 * Checks the resolved series colors and theme text tokens against WCAG 2.1
 * thresholds and returns advisory warning strings:
 *
 * - 1.4.11 (non-text contrast, 3:1): adjacent stacked/grouped series pairs
 *   and each series color against the chart background.
 * - 1.4.3 (text contrast, 4.5:1): theme text tokens against the background.
 *
 * Purely advisory: this module never throws and produces nothing unless the
 * host opts in via `compileChart(spec, { dev: true })`. The gate is a compile
 * option, NOT an environment sniff, because the engine is isomorphic and
 * `process.env` checks would leak a Node assumption into browser bundles.
 */

import type { MarkType, ResolvedTheme } from '@opendata-ai/openchart-core';
import { contrastRatio, findAccessibleColor, isOpaqueColor } from '@opendata-ai/openchart-core';
import type { ScaleOrdinal } from 'd3-scale';
import type { ResolvedScales } from '../layout/scales';

/** WCAG 1.4.11 minimum for graphical objects against adjacent colors. */
const GRAPHIC_MIN = 3;
/** WCAG 1.4.3 minimum for normal-size text. */
const TEXT_MIN = 4.5;

/** Mark types whose series render as adjacent filled regions when stacked/grouped. */
const ADJACENT_FILL_MARKS: ReadonlySet<MarkType> = new Set(['bar', 'area', 'arc', 'waffle']);

const fmt = (ratio: number): string => `${ratio.toFixed(2)}:1`;

/**
 * Collect WCAG contrast warnings for a compiled chart.
 *
 * @param scales - Resolved scales (series colors come from the color scale).
 * @param markType - Resolved mark type (adjacency only applies to filled marks).
 * @param theme - Resolved theme (background and text tokens).
 * @returns Advisory warning strings; empty when everything passes.
 */
export function collectContrastWarnings(
  scales: ResolvedScales,
  markType: MarkType,
  theme: ResolvedTheme,
): string[] {
  const warnings: string[] = [];

  // The default background is 'transparent' (the host page shows through),
  // which makes background-relative ratios meaningless at compile time.
  // Adjacent-series checks below don't need the background and always run.
  const bg = theme.colors.background;
  const bgIsCheckable = isOpaqueColor(bg);

  // Resolved per-series colors in domain (render) order. Sequential color
  // scales encode magnitude, not series identity; adjacency checks there
  // would flag every neighboring ramp stop, so only categorical scales apply.
  const series: Array<{ key: string; color: string }> = [];
  if (scales.color && scales.color.type !== 'sequential') {
    const ordinal = scales.color.scale as unknown as ScaleOrdinal<string, string>;
    for (const key of ordinal.domain()) {
      series.push({ key, color: ordinal(key) });
    }
  }

  // Adjacent series pairs (stacked segments / grouped neighbors render in
  // domain order, so consecutive series sit next to each other).
  if (ADJACENT_FILL_MARKS.has(markType)) {
    for (let i = 0; i < series.length - 1; i++) {
      const a = series[i];
      const b = series[i + 1];
      const ratio = contrastRatio(a.color, b.color);
      if (ratio < GRAPHIC_MIN) {
        const suggestion = findAccessibleColor(b.color, a.color, GRAPHIC_MIN);
        warnings.push(
          `[openchart a11y] Adjacent series "${a.key}" (${a.color}) and "${b.key}" (${b.color}) have ${fmt(ratio)} contrast, below the 3:1 WCAG 1.4.11 minimum for graphical objects. Nearest passing color for "${b.key}": ${suggestion}.`,
        );
      }
    }
  }

  if (bgIsCheckable) {
    // Each series against the chart background.
    for (const s of series) {
      const ratio = contrastRatio(s.color, bg);
      if (ratio < GRAPHIC_MIN) {
        const suggestion = findAccessibleColor(s.color, bg, GRAPHIC_MIN);
        warnings.push(
          `[openchart a11y] Series "${s.key}" (${s.color}) has ${fmt(ratio)} contrast against the background (${bg}), below the 3:1 WCAG 1.4.11 minimum. Nearest passing color: ${suggestion}.`,
        );
      }
    }

    // Text tokens at the 4.5:1 body-text threshold. Gridline/axis rules are
    // exempt: they are decorative per WCAG 1.4.11.
    const textTokens: Array<{ name: string; color: string }> = [
      { name: 'theme.colors.text', color: theme.colors.text },
      { name: 'theme.colors.annotationText', color: theme.colors.annotationText },
    ];
    for (const token of textTokens) {
      const ratio = contrastRatio(token.color, bg);
      if (ratio < TEXT_MIN) {
        const suggestion = findAccessibleColor(token.color, bg, TEXT_MIN);
        warnings.push(
          `[openchart a11y] ${token.name} (${token.color}) has ${fmt(ratio)} contrast against the background (${bg}), below the 4.5:1 WCAG 1.4.3 minimum for text. Nearest passing color: ${suggestion}.`,
        );
      }
    }
  }

  return warnings;
}
