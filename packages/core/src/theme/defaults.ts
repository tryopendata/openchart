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
import type { ThemeBase } from '../types/theme';

const FONT_SIZES = {
  title: 26,
  subtitle: 14,
  body: 13,
  small: 12,
  axisTick: 12,
  metricLabel: 11,
  metricValue: 22,
  endpointLabel: 13,
  endpointValue: 12,
};

/**
 * The default theme. All fields are required and fully specified.
 */
export const DEFAULT_THEME: ThemeBase = {
  colors: {
    categorical: [...CATEGORICAL_PALETTE],
    categoricalFill: [...CATEGORICAL_FILL_PALETTE],
    sequential: SEQUENTIAL_PALETTES,
    diverging: DIVERGING_PALETTES,
    background: 'transparent',
    text: '#09090b',
    gridline: 'rgba(0,0,0,0.05)',
    gridlineZero: 'rgba(0,0,0,0.22)',
    mapInteriorBorder: 'rgba(0,0,0,0.14)',
    mapOutlineBorder: 'rgba(0,0,0,0.40)',
    // Structural hairline: axis lines, separators. Deliberately heavier than
    // the gridline and lighter than any ink, so structure reads as structure.
    hairline: 'rgba(0,0,0,0.14)',
    // Used for axis lines/ticks AND axis tick label fill. Must clear WCAG AA
    // contrast (4.5:1) on white because tick labels are rendered with this
    // color. Zinc-500 hits ~5.7:1.
    axis: '#71717a',
    annotationFill: 'rgba(0,0,0,0.04)',
    annotationText: '#71717a',
    annotationLabel: '#333333',
    annotationMuted: '#6b7280',
    annotationLeader: '#8f8f8f',
    annotationRule: '#888888',
    annotationRangeFill: '#f0c040',
    annotationMarkerFill: '#ffffff',
    annotationPlate: '#ffffff',
    positive: '#15803d',
    negative: '#dc2626',
  },
  fonts: {
    family:
      '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    sizes: FONT_SIZES,
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
    chromeToChart: 16,
    chartToFooter: 12,
    axisMargin: 6,
    xAxisHeight: X_AXIS_BAND_HEIGHT,
    // Gap (px) between the x-axis line and the TOP of the tick labels. The
    // renderer treats this as a literal top gap and then shifts the label down
    // by textAscent() to land it on the alphabetic baseline (rather than
    // dominant-baseline:hanging, which WebKit positions from different metrics),
    // so the gap holds regardless of font size.
    xAxisLabelPadding: 4,
    endpointEntryGap: 6,
    endpointValueGap: 4,
    endpointColumnGap: 18,
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
      fontSize: FONT_SIZES.title,
      fontWeight: 600,
      color: '#09090b',
      lineHeight: 1.15,
    },
    subtitle: {
      fontSize: FONT_SIZES.subtitle,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.45,
    },
    source: {
      fontSize: FONT_SIZES.small,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.4,
    },
    byline: {
      fontSize: FONT_SIZES.small,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.4,
    },
    footer: {
      fontSize: FONT_SIZES.small,
      fontWeight: 400,
      color: '#71717a',
      lineHeight: 1.4,
    },
  },
  /** No editorial rule by default; the `broadsheet` preset sets one. */
  rule: null,
  seriesStrategy: 'palette',
};
