/**
 * Named theme presets built on the design token system.
 *
 * Each preset is a ThemeConfig object that can be passed to createChart()
 * or the React/Svelte/Vue Chart component. The engine deep-merges them
 * onto DEFAULT_THEME, so only the deltas are specified here.
 */

import type { ThemeConfig } from '../types/spec';

/** Editorial preset: the current default look. Exported for explicit selection. */
export const editorial: ThemeConfig = {};

/** Essay preset: serif display titles, warmer background, generous spacing. */
export const essay: ThemeConfig = {
  colors: {
    background: { light: '#faf8f5', dark: '#1a1816' },
    text: { light: '#1c1917', dark: '#e7e5e4' },
    gridline: { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.06)' },
    axis: { light: '#78716c', dark: '#a8a29e' },
  },
  fonts: {
    family: '"Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
    sizes: { title: 28, subtitle: 15, body: 14, small: 12 },
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  spacing: {
    padding: 24,
    chromeGap: 6,
    chromeToChart: 12,
    chartToFooter: 12,
  },
  chrome: {
    title: { fontWeight: 600, lineHeight: 1.2 },
    subtitle: { fontWeight: 400, lineHeight: 1.5 },
  },
  borderRadius: 0,
};

/** Wire preset: dense, mono numerals, tighter chrome. Dashboard/agency feel. */
export const wire: ThemeConfig = {
  colors: {
    background: { light: '#ffffff', dark: '#0a0a0a' },
    text: { light: '#171717', dark: '#ededed' },
    gridline: { light: 'rgba(0,0,0,0.06)', dark: 'rgba(255,255,255,0.06)' },
    axis: { light: '#737373', dark: '#a3a3a3' },
  },
  fonts: {
    family: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    sizes: { title: 16, subtitle: 12, body: 11, small: 10, axisTick: 10 },
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  spacing: {
    padding: 12,
    chromeGap: 2,
    chromeToChart: 4,
    chartToFooter: 4,
  },
  chrome: {
    title: { fontWeight: 600, lineHeight: 1.25 },
    subtitle: { fontWeight: 400, lineHeight: 1.3 },
  },
  borderRadius: 2,
};
