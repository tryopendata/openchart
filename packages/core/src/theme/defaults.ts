/**
 * Default theme definition.
 *
 * Tuned to match Infrographic's visual weight and editorial style.
 * Inter font family, typography hierarchy for chrome, and color
 * palettes from the colors module.
 */

import { CATEGORICAL_PALETTE, DIVERGING_PALETTES, SEQUENTIAL_PALETTES } from '../colors/palettes';
import type { Theme } from '../types/theme';

/**
 * The default theme. All fields are required and fully specified.
 * resolveTheme() deep-merges user overrides onto this base.
 */
export const DEFAULT_THEME: Theme = {
  colors: {
    categorical: [...CATEGORICAL_PALETTE],
    sequential: SEQUENTIAL_PALETTES,
    diverging: DIVERGING_PALETTES,
    background: '#ffffff',
    text: '#1d1d1d',
    gridline: '#e8e8e8',
    axis: '#888888',
    annotationFill: 'rgba(0,0,0,0.04)',
    annotationText: '#555555',
  },
  fonts: {
    family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    sizes: {
      title: 22,
      subtitle: 15,
      body: 13,
      small: 11,
      axisTick: 11,
    },
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    padding: 16,
    chromeGap: 4,
    chromeToChart: 8,
    chartToFooter: 8,
    axisMargin: 6,
  },
  borderRadius: 4,
  chrome: {
    title: {
      fontSize: 22,
      fontWeight: 700,
      color: '#333333',
      lineHeight: 1.3,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: 400,
      color: '#666666',
      lineHeight: 1.4,
    },
    source: {
      fontSize: 12,
      fontWeight: 400,
      color: '#999999',
      lineHeight: 1.3,
    },
    byline: {
      fontSize: 12,
      fontWeight: 400,
      color: '#999999',
      lineHeight: 1.3,
    },
    footer: {
      fontSize: 12,
      fontWeight: 400,
      color: '#999999',
      lineHeight: 1.3,
    },
  },
};
