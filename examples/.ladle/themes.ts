/**
 * Named theme registry for the gallery's floating theme picker.
 *
 * Six full house styles, not eleven palette swaps. Each one (except `Default`,
 * which is the library's own look) sets a complete design system: a six-hue
 * stroke palette with matching fills, surface/text/gridline/hairline/axis
 * colors for both modes, semantic positive/negative, a typeface with its own
 * size and weight ladder, a border radius, and chrome typography. Swapping the
 * picker should change the personality of every chart on the page, not just
 * its hues.
 *
 * Every categorical array here was generated in OKLCH and checked with the
 * repo's own Brettel CVD simulator (`checkPaletteDistinguishability`) for
 * deuteranopia and protanopia at minDistance 30, strokes and fills alike; the
 * per-theme comment records the worst simulated pair distance.
 */
import type { ThemeConfig } from '@opendata-ai/openchart-core';

export const themes: Record<string, ThemeConfig | undefined> = {
  /** The library defaults: Inter, cyan-led six-hue palette, 8px radius. */
  Default: undefined,

  /**
   * Ink — newsprint. Charter/Georgia on warm paper, a 28px bold serif title,
   * square corners, and a palette pulled one step darker than the default set.
   * Worst CVD pair distance: 37.9.
   */
  Ink: {
    colors: {
      categorical: ['#0092b9', '#c59128', '#3d4caa', '#a32b5d', '#009068', '#9e6ec0'],
      categoricalFill: ['#3a98b9', '#c29a55', '#4c5da7', '#b04f71', '#409a77', '#a580c0'],
      background: { light: '#faf9f6', dark: '#16150f' },
      text: { light: '#141210', dark: '#f2efe6' },
      gridline: { light: 'rgba(20,18,16,0.08)', dark: 'rgba(242,239,230,0.07)' },
      hairline: { light: 'rgba(20,18,16,0.2)', dark: 'rgba(242,239,230,0.2)' },
      axis: { light: '#6b6660', dark: '#a8a29a' },
      annotationFill: { light: 'rgba(20,18,16,0.05)', dark: 'rgba(242,239,230,0.06)' },
      annotationText: { light: '#6b6660', dark: '#a8a29a' },
      positive: { light: '#1f7a46', dark: '#5fd08c' },
      negative: { light: '#b3261e', dark: '#f08b83' },
    },
    fonts: {
      family: 'Charter, "Iowan Old Style", Georgia, "Times New Roman", serif',
      mono: '"JetBrains Mono", "Fira Code", monospace',
      sizes: { title: 28, subtitle: 15, body: 14, small: 12, axisTick: 12 },
      weights: { normal: 400, medium: 500, semibold: 700, bold: 700 },
    },
    chrome: {
      eyebrow: { color: { light: '#a32b5d', dark: '#e07ca0' }, fontSize: 12, fontWeight: 700 },
      title: { fontSize: 28, fontWeight: 700, lineHeight: 1.15 },
      subtitle: { fontWeight: 400, lineHeight: 1.45 },
    },
    borderRadius: 0,
  },

  /**
   * Midnight — a dark product surface. Helvetica Neue, slate canvas, generous
   * 8px radius, teal-led palette. Worst CVD pair distance: 31.5.
   */
  Midnight: {
    colors: {
      categorical: ['#00cac2', '#ffb797', '#2d9dd7', '#d084d5', '#94b86d', '#9dabf7'],
      categoricalFill: ['#66c4be', '#fec1a6', '#56a1ce', '#ce92d1', '#9ab580', '#abb7ef'],
      background: { light: '#0f172a', dark: '#0f172a' },
      text: { light: '#e2e8f0', dark: '#e2e8f0' },
      gridline: { light: 'rgba(226,232,240,0.07)', dark: 'rgba(226,232,240,0.07)' },
      hairline: { light: 'rgba(226,232,240,0.16)', dark: 'rgba(226,232,240,0.16)' },
      axis: { light: '#94a3b8', dark: '#94a3b8' },
      annotationFill: { light: 'rgba(226,232,240,0.07)', dark: 'rgba(226,232,240,0.07)' },
      annotationText: { light: '#94a3b8', dark: '#94a3b8' },
      positive: { light: '#4ade80', dark: '#4ade80' },
      negative: { light: '#f87171', dark: '#f87171' },
    },
    fonts: {
      family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      mono: '"SF Mono", Menlo, Monaco, monospace',
      sizes: { title: 24, subtitle: 14, body: 13, small: 11, axisTick: 11 },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
    chrome: {
      eyebrow: { color: { light: '#00cac2', dark: '#00cac2' }, fontSize: 11, fontWeight: 600 },
      title: { fontSize: 24, fontWeight: 600, lineHeight: 1.2 },
      subtitle: { fontWeight: 400, lineHeight: 1.45 },
    },
    borderRadius: 8,
  },

  /**
   * Terminal — a monitoring console. JetBrains Mono throughout, near-black
   * canvas, tight 20px title. Worst CVD pair distance: 32.6.
   */
  Terminal: {
    colors: {
      categorical: ['#29d2f2', '#f9be78', '#6691e1', '#d771a4', '#6ebf8c', '#bca1ed'],
      categoricalFill: ['#74cde2', '#f3c898', '#7698d6', '#d281a8', '#82ba95', '#c2afe7'],
      background: { light: '#0b0f14', dark: '#0b0f14' },
      text: { light: '#e6edf3', dark: '#e6edf3' },
      gridline: { light: 'rgba(230,237,243,0.06)', dark: 'rgba(230,237,243,0.06)' },
      hairline: { light: 'rgba(230,237,243,0.14)', dark: 'rgba(230,237,243,0.14)' },
      axis: { light: '#8b949e', dark: '#8b949e' },
      annotationFill: { light: 'rgba(230,237,243,0.06)', dark: 'rgba(230,237,243,0.06)' },
      annotationText: { light: '#8b949e', dark: '#8b949e' },
      positive: { light: '#4ade80', dark: '#4ade80' },
      negative: { light: '#f87171', dark: '#f87171' },
    },
    fonts: {
      family: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      sizes: { title: 20, subtitle: 12, body: 12, small: 10, axisTick: 10 },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
    chrome: {
      eyebrow: { color: { light: '#29d2f2', dark: '#29d2f2' }, fontSize: 10, fontWeight: 500 },
      title: { fontSize: 20, fontWeight: 600, lineHeight: 1.3 },
      subtitle: { fontWeight: 400, lineHeight: 1.4 },
    },
    borderRadius: 2,
  },

  /**
   * Field — a field-guide look. Palatino on oatmeal paper, olive/rust/indigo
   * hues, restrained radius. Worst CVD pair distance: 34.4.
   */
  Field: {
    colors: {
      categorical: ['#538dd5', '#b3b549', '#9d73d7', '#bd4233', '#009393', '#cc76b1'],
      categoricalFill: ['#6794ce', '#b8ba6d', '#a686d6', '#c86455', '#269f9f', '#cf8bb8'],
      background: { light: '#f7f5ef', dark: '#1b1c16' },
      text: { light: '#22261c', dark: '#eae7da' },
      gridline: { light: 'rgba(34,38,28,0.08)', dark: 'rgba(234,231,218,0.07)' },
      hairline: { light: 'rgba(34,38,28,0.18)', dark: 'rgba(234,231,218,0.18)' },
      axis: { light: '#6d6f5f', dark: '#a0a291' },
      annotationFill: { light: 'rgba(34,38,28,0.05)', dark: 'rgba(234,231,218,0.06)' },
      annotationText: { light: '#6d6f5f', dark: '#a0a291' },
      positive: { light: '#4a7c3f', dark: '#8fc97e' },
      negative: { light: '#b3402f', dark: '#eb8a78' },
    },
    fonts: {
      family: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      mono: '"Iosevka", "JetBrains Mono", monospace',
      sizes: { title: 24, subtitle: 15, body: 14, small: 12, axisTick: 12 },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
    chrome: {
      eyebrow: { color: { light: '#bd4233', dark: '#eb8a78' }, fontSize: 12, fontWeight: 600 },
      title: { fontSize: 24, fontWeight: 600, lineHeight: 1.2 },
      // Long, quiet subtitles are the field-guide voice.
      subtitle: { fontWeight: 400, lineHeight: 1.55 },
    },
    borderRadius: 2,
  },

  /**
   * Signal — a night-mode consumer app. DM Sans, ink-violet canvas, saturated
   * hues and a soft 12px radius. Worst CVD pair distance: 31.3.
   */
  Signal: {
    colors: {
      categorical: ['#73c6ff', '#e7c954', '#8d7fef', '#f06275', '#00b7a1', '#dd91e1'],
      categoricalFill: ['#76c7ff', '#e5d084', '#938be1', '#e77782', '#4cb3a1', '#dca4de'],
      background: { light: '#0a0a12', dark: '#0a0a12' },
      text: { light: '#eceaf5', dark: '#eceaf5' },
      gridline: { light: 'rgba(236,234,245,0.07)', dark: 'rgba(236,234,245,0.07)' },
      hairline: { light: 'rgba(236,234,245,0.16)', dark: 'rgba(236,234,245,0.16)' },
      axis: { light: '#9a97ad', dark: '#9a97ad' },
      annotationFill: { light: 'rgba(236,234,245,0.07)', dark: 'rgba(236,234,245,0.07)' },
      annotationText: { light: '#9a97ad', dark: '#9a97ad' },
      positive: { light: '#4ade80', dark: '#4ade80' },
      negative: { light: '#f06275', dark: '#f06275' },
    },
    fonts: {
      family: '"DM Sans", "Nunito Sans", system-ui, sans-serif',
      mono: '"DM Mono", "JetBrains Mono", monospace',
      sizes: { title: 26, subtitle: 14, body: 13, small: 11, axisTick: 11 },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
    chrome: {
      eyebrow: { color: { light: '#73c6ff', dark: '#73c6ff' }, fontSize: 11, fontWeight: 600 },
      title: { fontSize: 26, fontWeight: 600, lineHeight: 1.18 },
      subtitle: { fontWeight: 400, lineHeight: 1.45 },
    },
    borderRadius: 12,
  },
};

export const themeNames = Object.keys(themes);
