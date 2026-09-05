import { hsl } from 'd3-color';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../colors/contrast';
import { CATEGORICAL_FILL_PALETTE_DARK, CATEGORICAL_PALETTE_DARK } from '../../colors/palettes';
import { adaptColorForDarkMode, adaptForLightLineStroke, adaptTheme } from '../dark-mode';
import { resolveTheme } from '../resolve';

describe('adaptColorForDarkMode', () => {
  const lightBg = '#ffffff';
  const darkBg = '#09090b';

  it('adapted color has similar contrast on dark bg as original on light bg', () => {
    const original = '#06b6d4'; // cyan, primary accent
    const adapted = adaptColorForDarkMode(original, lightBg, darkBg);

    const originalRatio = contrastRatio(original, lightBg);
    const adaptedRatio = contrastRatio(adapted, darkBg);

    // Should be within 30% of the original ratio
    const tolerance = originalRatio * 0.3;
    expect(Math.abs(adaptedRatio - originalRatio)).toBeLessThan(tolerance);
  });

  it('returns unchanged input for unparseable colors (e.g. raw oklch)', () => {
    const result = adaptColorForDarkMode('oklch(70% 0.15 200)', lightBg, darkBg);
    expect(result).toBe('oklch(70% 0.15 200)');
  });

  it('returns a valid hex color', () => {
    const result = adaptColorForDarkMode('#e15759', lightBg, darkBg);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('handles pure black gracefully', () => {
    const result = adaptColorForDarkMode('#000000', lightBg, darkBg);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('adaptForLightLineStroke', () => {
  it('darkens a saturated cyan by ~12% lightness', () => {
    const original = '#06b6d4';
    const darkened = adaptForLightLineStroke(original);
    expect(darkened).not.toBe(original);
    const c = hsl(darkened);
    const o = hsl(original);
    expect(c).not.toBeNull();
    expect(c!.l).toBeCloseTo(o.l - 0.12, 2);
  });

  it('passes saturated red and blue through with reduced lightness', () => {
    for (const color of ['#ef4444', '#3b82f6']) {
      const out = adaptForLightLineStroke(color);
      const before = hsl(color);
      const after = hsl(out);
      expect(after!.l).toBeLessThan(before.l);
    }
  });

  it('passes pure gray through unchanged (saturation below threshold)', () => {
    // zinc-400 has near-zero saturation; reducing lightness on a gray would
    // shift it toward black, which isn't desired for achromatic palettes.
    expect(adaptForLightLineStroke('#a1a1aa')).toBe('#a1a1aa');
  });

  it('passes already-dark colors through unchanged (l <= 0.4)', () => {
    // Indigo-900 sits at l ≈ 0.30 — already meets contrast on white.
    const dark = '#312e81';
    expect(adaptForLightLineStroke(dark)).toBe(dark);
  });

  it('passes invalid input through unchanged', () => {
    expect(adaptForLightLineStroke('not-a-color')).toBe('not-a-color');
    expect(adaptForLightLineStroke('')).toBe('');
  });
});

describe('adaptTheme', () => {
  it('sets isDark to true', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    expect(dark.isDark).toBe(true);
  });

  it('preserves transparent background in dark mode', () => {
    const light = resolveTheme();
    // Default background is transparent; adaptTheme preserves it so the
    // host page's surface shows through in both light and dark contexts.
    const dark = adaptTheme(light);
    expect(dark.colors.background).toBe('transparent');
  });

  it('swaps to dark background when starting from an explicit light color', () => {
    const light = resolveTheme({ colors: { background: '#ffffff' } });
    const dark = adaptTheme(light);
    expect(dark.colors.background).toBe('#09090b');
  });

  it('updates text color for dark mode', () => {
    // Use an explicit light background so the contrast ratio check has a
    // concrete background to measure against.
    const light = resolveTheme({ colors: { background: '#ffffff' } });
    const dark = adaptTheme(light);
    expect(dark.colors.text).not.toBe(light.colors.text);
    // Dark text should be light — measure against the dark canvas color.
    const ratio = contrastRatio(dark.colors.text, '#09090b');
    expect(ratio).toBeGreaterThan(4);
  });

  it('swaps in the purpose-built dark palette, and passes a custom one through', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    // Contrast-equivalence adaptation dulls cyan into teal, so the dark
    // variants are authored (L raised ~0.10, chroma trimmed) rather than
    // derived from the light hexes.
    expect(dark.colors.categorical).toEqual([...CATEGORICAL_PALETTE_DARK]);
    expect(dark.colors.categoricalFill).toEqual([...CATEGORICAL_FILL_PALETTE_DARK]);

    const custom = adaptTheme(resolveTheme({ colors: ['#111111', '#222222'] }));
    expect(custom.colors.categorical).toEqual(['#111111', '#222222']);
    expect(custom.colors.categoricalFill).toEqual(['#111111', '#222222']);
  });

  it('updates chrome text colors', () => {
    const light = resolveTheme();
    const dark = adaptTheme(light);
    expect(dark.chrome.title.color).not.toBe(light.chrome.title.color);
  });

  it('preserves an explicit axis color override in dark mode', () => {
    const light = resolveTheme({ colors: { background: '#ffffff', axis: '#d0d6e0' } });
    const dark = adaptTheme(light);
    expect(dark.colors.axis).toBe('#d0d6e0');
  });

  it('applies the dark axis default when axis is left unset', () => {
    const light = resolveTheme({ colors: { background: '#ffffff' } });
    const dark = adaptTheme(light);
    expect(dark.colors.axis).toBe('#a1a1aa');
  });

  it('preserves explicit chrome color overrides in dark mode', () => {
    const light = resolveTheme({
      colors: { background: '#ffffff' },
      chrome: { subtitle: '#d0d6e0', source: '#d0d6e0' },
    });
    const dark = adaptTheme(light);
    expect(dark.chrome.subtitle.color).toBe('#d0d6e0');
    expect(dark.chrome.source.color).toBe('#d0d6e0');
  });

  it('applies dark chrome defaults when chrome colors are left unset', () => {
    const light = resolveTheme({ colors: { background: '#ffffff' } });
    const dark = adaptTheme(light);
    // Unset chrome colors fall to the muted dark default, not the light one.
    expect(dark.chrome.subtitle.color).not.toBe('#71717a');
  });

  it('uses explicit dark pair value for background instead of algorithmic adaptation', () => {
    const light = resolveTheme({
      colors: { background: { light: '#fff1e5', dark: '#1a1311' } },
    });
    const dark = adaptTheme(light);
    expect(dark.colors.background).toBe('#1a1311');
  });

  it('uses explicit dark pair value for text instead of algorithmic adaptation', () => {
    const light = resolveTheme({
      colors: {
        background: { light: '#ffffff', dark: '#111111' },
        text: { light: '#1c1917', dark: '#e7e5e4' },
      },
    });
    const dark = adaptTheme(light);
    expect(dark.colors.text).toBe('#e7e5e4');
  });

  it('uses explicit dark pair for gridline and axis', () => {
    const light = resolveTheme({
      colors: {
        background: { light: '#fff', dark: '#111' },
        gridline: { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.06)' },
        axis: { light: '#78716c', dark: '#a8a29e' },
      },
    });
    const dark = adaptTheme(light);
    expect(dark.colors.gridline).toBe('rgba(255,255,255,0.06)');
    expect(dark.colors.axis).toBe('#a8a29e');
  });

  it('uses explicit dark pair for semantic colors', () => {
    const light = resolveTheme({
      colors: {
        background: { light: '#fff', dark: '#111' },
        positive: { light: '#10b981', dark: '#34d399' },
        negative: { light: '#e11d48', dark: '#fb7185' },
      },
    });
    const dark = adaptTheme(light);
    expect(dark.colors.positive).toBe('#34d399');
    expect(dark.colors.negative).toBe('#fb7185');
  });

  it('uses explicit dark pair for chrome element color', () => {
    const light = resolveTheme({
      colors: { background: { light: '#fff', dark: '#111' } },
      chrome: {
        title: { color: { light: '#33302e', dark: '#f2dfce' } },
      },
    });
    const dark = adaptTheme(light);
    expect(dark.chrome.title.color).toBe('#f2dfce');
  });

  it('uses explicit dark pair for eyebrow color (otherwise kept as-is)', () => {
    const light = resolveTheme({
      chrome: {
        eyebrow: { color: { light: '#e3120b', dark: '#ff6b64' } },
      },
    });
    const dark = adaptTheme(light);
    expect(dark.chrome.eyebrow.color).toBe('#ff6b64');

    // Without a pair, the eyebrow keeps its accent tint across modes.
    const noPair = adaptTheme(resolveTheme({ chrome: { eyebrow: '#e3120b' } }));
    expect(noPair.chrome.eyebrow.color).toBe('#e3120b');
  });

  it('falls back to algorithmic adaptation when no explicit dark pair is given', () => {
    const light = resolveTheme({
      colors: { background: '#ffffff' },
    });
    const dark = adaptTheme(light);
    // Text should be adapted to a light color for dark bg readability
    expect(dark.colors.text).not.toBe(light.colors.text);
    expect(dark.colors.text).toBeDefined();
  });
});
