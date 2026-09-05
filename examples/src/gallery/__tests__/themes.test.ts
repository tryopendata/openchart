/**
 * Contract for the gallery's named house styles (`examples/.ladle/themes.ts`).
 *
 * The picker is the library's shop window: if a theme ships unreadable tick
 * labels or a lead hue that vanishes against its own canvas, every page in the
 * gallery is wrong at once. These assertions are the gate.
 */
import type { ThemeConfig } from '@opendata-ai/openchart-core';
import { contrastRatio, meetsAA, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { themeNames, themes } from '../../../.ladle/themes';

const EXPECTED = ['Default', 'Ink', 'Midnight', 'Terminal', 'Field', 'Signal'];

/** Light half of a TokenValue, or the plain string. */
function light(v: unknown): string {
  return typeof v === 'string' ? v : ((v as { light: string }).light ?? '');
}

/** The five house styles that carry an explicit palette (`Default` does not). */
const houseStyles = EXPECTED.filter((n) => n !== 'Default').map(
  (name) => [name, themes[name] as ThemeConfig] as const,
);

describe('gallery themes', () => {
  it('registers exactly six house styles in order', () => {
    expect(themeNames).toEqual(EXPECTED);
  });

  it('leaves Default as the library defaults', () => {
    expect(themes.Default).toBeUndefined();
  });

  it.each(houseStyles)('%s sets a full house style, not a palette swap', (_name, theme) => {
    const colors = theme.colors as Exclude<ThemeConfig['colors'], string[] | undefined>;
    expect(colors.categorical).toHaveLength(6);
    expect(colors.categoricalFill).toHaveLength(6);
    for (const key of [
      'background',
      'text',
      'gridline',
      'hairline',
      'axis',
      'annotationFill',
      'annotationText',
      'positive',
      'negative',
    ] as const) {
      expect(colors[key], key).toBeDefined();
    }
    expect(theme.fonts?.family).toBeTruthy();
    expect(theme.fonts?.mono).toBeTruthy();
    expect(theme.fonts?.sizes).toBeTruthy();
    expect(theme.fonts?.weights).toBeTruthy();
    expect(typeof theme.borderRadius).toBe('number');
    expect(theme.chrome?.title).toBeTruthy();
  });

  it.each(houseStyles)('%s is readable on its own surface', (_name, theme) => {
    const colors = theme.colors as Exclude<ThemeConfig['colors'], string[] | undefined>;
    const bg = light(colors.background);
    // Body text and the axis ink (which doubles as the tick-label fill) both
    // have to clear AA on the theme's own canvas.
    expect(meetsAA(light(colors.text), bg)).toBe(true);
    expect(meetsAA(light(colors.axis), bg)).toBe(true);
    // WCAG 1.4.11: the lead series hue is a non-text graphic at 3:1.
    expect(contrastRatio((colors.categorical as string[])[0], bg)).toBeGreaterThanOrEqual(3);
  });

  it.each(
    houseStyles,
  )('%s resolves without falling back to the default palette', (_name, theme) => {
    const resolved = resolveTheme(theme);
    expect(resolved.colors.categorical).toHaveLength(6);
    expect(resolved.colors.categoricalFill).not.toEqual(resolved.colors.categorical);
  });
});
