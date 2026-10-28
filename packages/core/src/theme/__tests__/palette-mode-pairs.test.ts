import { describe, expect, it } from 'vitest';
import { adaptTheme } from '../dark-mode';
import { resolveTheme } from '../resolve';

const palette = [{ light: '#123456', dark: '#abcdef' }, '#f08020'];

describe('palette slot mode pairs', () => {
  it('resolves mixed slots to strings and inherits paired fills', () => {
    const config = { colors: { categorical: palette } };
    const light = resolveTheme(config);
    const dark = adaptTheme(light);
    expect(light.colors.categorical).toEqual(['#123456', '#f08020']);
    expect(light.colors.categoricalFill).toEqual(light.colors.categorical);
    expect(dark.colors.categorical).toEqual(['#abcdef', '#f08020']);
    expect(dark.colors.categoricalFill).toEqual(dark.colors.categorical);
    expect(config.colors.categorical).toEqual(palette);
  });

  it('keeps authored fill arrays independent of stroke pairs', () => {
    const theme = resolveTheme({ colors: { categorical: palette, categoricalFill: ['#888888'] } });
    expect(adaptTheme(theme).colors.categoricalFill).toEqual(['#888888']);
  });

  it('supports independent fill pairs and plain authored palettes', () => {
    const theme = resolveTheme({ colors: { categorical: ['#123456'], categoricalFill: palette } });
    expect(adaptTheme(theme).colors.categorical).toEqual(['#123456']);
    expect(adaptTheme(theme).colors.categoricalFill).toEqual(['#abcdef', '#f08020']);
  });
});
