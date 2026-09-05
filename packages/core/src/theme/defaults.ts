/**
 * Default theme definition.
 *
 * Editorial design system with a cyan-led six-hue categorical palette, Inter
 * Variable typography (weights 400/500/600/700), and zinc-based achromatic
 * surfaces. Light is the default surface; dark adaptation lives in
 * dark-mode.ts.
 *
 * resolveTheme() deep-merges user overrides onto this base.
 */

import {
  CATEGORICAL_FILL_PALETTE,
  CATEGORICAL_PALETTE,
  DIVERGING_PALETTES,
  SEQUENTIAL_PALETTES,
} from '../colors/palettes';
import { X_AXIS_BAND_HEIGHT } from '../responsive/metrics';
import type { Theme } from '../types/theme';

/**
 * The default theme. All fields are required and fully specified.
 */
export const DEFAULT_THEME: Theme = {
  colors: {
    categorical: [...CATEGORICAL_PALETTE],
    categoricalFill: [...CATEGORICAL_FILL_PALETTE],
    sequential: SEQUENTIAL_PALETTES,
    diverging: DIVERGING_PALETTES,
    background: 'transparent',
    text: '#09090b',
    gridline: 'rgba(0,0,0,0.08)',
    // Structural hairline: axis lines, separators. Deliberately heavier than
    // the gridline and lighter than any ink, so structure reads as structure.
    hairline: 'rgba(0,0,0,0.14)',
    // Used for axis lines/ticks AND axis tick label fill. Must clear WCAG AA
    // contrast (4.5:1) on white because tick labels are rendered with this
    // color. Zinc-500 hits ~5.7:1.
    axis: '#71717a',
    annotationFill: 'rgba(0,0,0,0.04)',
    annotationText: '#71717a',
    positive: '#15803d',
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
      metricLabel: 10,
      metricValue: 22,
    },
    // One ladder everywhere: 400 regular / 500 medium (eyebrow, labels, UI,
    // values) / 600 semibold (title, series names, annotation lede) / 700 bold.
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    padding: 20,
    chromeGap: 6,
    chromeToChart: 8,
    chartToFooter: 8,
    axisMargin: 6,
    xAxisHeight: X_AXIS_BAND_HEIGHT,
    // Gap (px) between the x-axis line and the TOP of the tick labels. The
    // renderer treats this as a literal top gap and then shifts the label down
    // by textAscent() to land it on the alphabetic baseline (rather than
    // dominant-baseline:hanging, which WebKit positions from different metrics),
    // so the gap holds regardless of font size.
    xAxisLabelPadding: 4,
  },
  /** Containers and tooltips. Marks carry their own 2px radius constant. */
  borderRadius: 8,
  chrome: {
    eyebrow: {
      fontSize: 11,
      fontWeight: 500,
      color: '#06b6d4',
      lineHeight: 1.4,
    },
    title: {
      fontSize: 26,
      fontWeight: 600,
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
  seriesStrategy: 'palette',
};
