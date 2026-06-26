/**
 * Default theme definition.
 *
 * Editorial design system with cyan-led categorical palette, Inter
 * Variable typography (weights 400/510/590), and zinc-based achromatic
 * surfaces. Light is the default surface; dark adaptation lives in
 * dark-mode.ts.
 *
 * resolveTheme() deep-merges user overrides onto this base.
 */

import { CATEGORICAL_PALETTE, DIVERGING_PALETTES, SEQUENTIAL_PALETTES } from '../colors/palettes';
import type { Theme } from '../types/theme';

/**
 * The default theme. All fields are required and fully specified.
 */
export const DEFAULT_THEME: Theme = {
  colors: {
    categorical: [...CATEGORICAL_PALETTE],
    sequential: SEQUENTIAL_PALETTES,
    diverging: DIVERGING_PALETTES,
    background: 'transparent',
    text: '#09090b',
    gridline: 'rgba(0,0,0,0.1)',
    // Used for axis lines/ticks AND axis tick label fill. Must clear WCAG AA
    // contrast (4.5:1) on white because tick labels are rendered with this
    // color. Zinc-500 hits ~5.7:1.
    axis: '#71717a',
    annotationFill: 'rgba(0,0,0,0.04)',
    annotationText: '#71717a',
    positive: '#16a34a',
    negative: '#dc2626',
  },
  fonts: {
    family:
      '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    sizes: {
      title: 26,
      subtitle: 14,
      body: 13,
      small: 11,
      axisTick: 11,
    },
    weights: {
      normal: 450,
      medium: 550,
      semibold: 590,
      bold: 700,
    },
  },
  spacing: {
    padding: 20,
    chromeGap: 4,
    chromeToChart: 8,
    chartToFooter: 8,
    axisMargin: 6,
    xAxisHeight: 26,
    // Gap (px) between the x-axis line and the TOP of the tick labels. The
    // renderer anchors x-tick labels at their top edge (hanging baseline), so
    // this is a literal top gap that holds regardless of font size.
    xAxisLabelPadding: 4,
  },
  borderRadius: 2,
  chrome: {
    eyebrow: {
      fontSize: 11,
      fontWeight: 510,
      color: '#06b6d4',
      lineHeight: 1.4,
    },
    title: {
      fontSize: 26,
      fontWeight: 590,
      color: '#09090b',
      lineHeight: 1.15,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.45,
    },
    source: {
      fontSize: 11,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.4,
    },
    byline: {
      fontSize: 11,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.4,
    },
    footer: {
      fontSize: 11,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.4,
    },
  },
};
