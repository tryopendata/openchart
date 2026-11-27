/**
 * Named theme presets built on the design token system.
 *
 * Each preset is a ThemeConfig object that can be passed to createChart()
 * or the React/Svelte/Vue Chart component. The engine deep-merges them
 * onto DEFAULT_THEME, so only the deltas are specified here.
 */

import { CATEGORICAL_FILL_PALETTE_DARK, CATEGORICAL_PALETTE_DARK } from '../colors/palettes';
import type { ThemeConfig } from '../types/spec';

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

/**
 * Broadsheet preset: newspaper editorial. Warm paper, a red masthead rule and
 * eyebrow, a bold 24px title, and a quiet palette built around one loud hue.
 *
 * Palette (measured OKLCH; checked with the repo's Brettel CVD simulator —
 * deuteranopia and protanopia both pass, nearest simulated pair 48.7 against
 * a threshold of 30):
 *   1 #1d5f8a oklch(0.466 0.095 242)  ink blue
 *   2 #e3120b oklch(0.580 0.232  29)  house red — the one loud hue
 *   3 #7fb0d3 oklch(0.735 0.073 240)  pale blue
 *   4 #e0a63b oklch(0.762 0.137  79)  ochre
 *   5 #3a8a6e oklch(0.576 0.090 167)  green
 *   6 #8c8680 oklch(0.623 0.011  68)  warm gray
 * Fills are the same hues one step lighter (L +0.06, chroma -12%).
 *
 * Dark mode is the same page after nightfall: the newsprint gives way to an
 * ink-blue ground, with the same hues lifted to hold their contrast on it.
 * Palette (dark; checked with the Brettel simulator, nearest simulated pair
 * 31.6 under deuteranopia against a threshold of 30, every stroke at 5.8:1
 * or better and every fill at 5.3:1 or better on #12181f):
 *   1 #5e9fd6 ink blue, lifted      2 #f4655a house red, lifted
 *   3 #93c2e2 pale blue             4 #e0b267 ochre
 *   5 #4fb093 green                 6 #9aa1a8 gray, cooled
 * Fills sit a step lighter and quieter than their strokes, as in light mode.
 */
export const broadsheet: ThemeConfig = {
  colors: {
    categorical: [
      { light: '#1d5f8a', dark: '#5e9fd6' },
      { light: '#e3120b', dark: '#f4655a' },
      { light: '#7fb0d3', dark: '#93c2e2' },
      { light: '#e0a63b', dark: '#e0b267' },
      { light: '#3a8a6e', dark: '#4fb093' },
      { light: '#8c8680', dark: '#9aa1a8' },
    ],
    categoricalFill: [
      { light: '#3b7097', dark: '#80b5e3' },
      { light: '#ee493a', dark: '#ec5b50' },
      { light: '#97c2e2', dark: '#acd3eb' },
      { light: '#efbb64', dark: '#c6ad55' },
      { light: '#579a81', dark: '#5bd2ac' },
      { light: '#9e9893', dark: '#b4b9bf' },
    ],
    background: { light: '#fffdf9', dark: '#12181f' },
    text: { light: '#1a1714', dark: '#e9ebe6' },
    gridline: { light: 'rgba(26,23,20,0.08)', dark: 'rgba(233,235,230,0.07)' },
    // Heavier than the default 0.14: newsprint rules are drawn to be seen.
    hairline: { light: 'rgba(26,23,20,0.28)', dark: 'rgba(233,235,230,0.28)' },
    axis: { light: '#6b645c', dark: '#9aa4ad' },
    annotationFill: { light: 'rgba(26,23,20,0.05)', dark: 'rgba(233,235,230,0.07)' },
    annotationText: { light: '#6b645c', dark: '#9aa4ad' },
  },
  fonts: {
    sizes: { title: 24, subtitle: 14, body: 13, small: 11 },
  },
  spacing: {
    padding: 20,
    chromeGap: 8,
    chromeToChart: 16,
    chartToFooter: 12,
  },
  chrome: {
    eyebrow: { color: { light: '#e3120b', dark: '#f4463f' }, fontSize: 11, fontWeight: 700 },
    title: { fontWeight: 700, lineHeight: 1.18 },
    subtitle: { fontWeight: 400, lineHeight: 1.45 },
  },
  /** The masthead device: a short red bar above the eyebrow. */
  rule: { color: { light: '#e3120b', dark: '#f4463f' }, width: 40, thickness: 3 },
  borderRadius: 0,
};

/**
 * Terminal preset: a dense dark product surface. Dark in BOTH modes — the
 * resolver detects the dark background and adapts chrome text without
 * `darkMode` being set — so it carries the dark palette variants explicitly
 * rather than waiting for adaptTheme().
 *
 * `seriesStrategy: 'accent-neutral'` keeps one cyan accent against neutral
 * siblings, the register a monitoring UI wants.
 */
export const terminal: ThemeConfig = /* @__PURE__ */ (() => ({
  colors: {
    categorical: [...CATEGORICAL_PALETTE_DARK],
    categoricalFill: [...CATEGORICAL_FILL_PALETTE_DARK],
    background: { light: '#0b0f14', dark: '#0b0f14' },
    text: { light: '#e6edf3', dark: '#e6edf3' },
    gridline: { light: 'rgba(230,237,243,0.06)', dark: 'rgba(230,237,243,0.06)' },
    hairline: { light: 'rgba(230,237,243,0.14)', dark: 'rgba(230,237,243,0.14)' },
    // 6.25:1 on #0b0f14 — tick labels are drawn in this color too.
    axis: { light: '#8b949e', dark: '#8b949e' },
    annotationFill: { light: 'rgba(230,237,243,0.06)', dark: 'rgba(230,237,243,0.06)' },
    annotationText: { light: '#8b949e', dark: '#8b949e' },
    positive: { light: '#4ade80', dark: '#4ade80' },
    negative: { light: '#f87171', dark: '#f87171' },
  },
  fonts: {
    family:
      '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    sizes: { title: 15, subtitle: 12, body: 12, small: 10, axisTick: 10 },
  },
  spacing: {
    padding: 12,
    chromeGap: 3,
    chromeToChart: 6,
    chartToFooter: 6,
  },
  chrome: {
    eyebrow: { color: { light: '#22d3ee', dark: '#22d3ee' }, fontSize: 10, fontWeight: 500 },
    title: { fontWeight: 600, lineHeight: 1.3 },
    subtitle: { fontWeight: 400, lineHeight: 1.4 },
  },
  borderRadius: 4,
  seriesStrategy: 'accent-neutral',
}))();

/** @deprecated v9 adopts clarity typography by default. Set its remaining colors explicitly; removed in v10. */
export const clarity: ThemeConfig = {
  colors: {
    background: { light: '#ffffff', dark: '#09090b' },
    axis: { light: '#52525b', dark: '#a1a1aa' },
  },
  chrome: {
    eyebrow: { color: { light: '#0f766e', dark: '#5eead4' } },
  },
};

/** Documented v8 typography. This does not freeze the layout engine. */
export const legacyEditorial: ThemeConfig = {
  fonts: { sizes: { title: 26, subtitle: 14, body: 13, small: 11, axisTick: 11 } },
  spacing: { padding: 20, chromeGap: 6, chromeToChart: 8, chartToFooter: 8 },
};
