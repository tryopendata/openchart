import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ThemeConfig } from '../../types/spec';
import type { ResolvedTheme } from '../../types/theme';
import { mergeThemeConfig } from '../merge';

describe('authored theme contract', () => {
  it('covers every resolved theme key except runtime metadata', () => {
    type Missing = Exclude<
      keyof ResolvedTheme,
      keyof ThemeConfig | 'isDark' | '_tokenPairs' | '_authored'
    >;
    expectTypeOf<Missing>().toEqualTypeOf<never>();
  });
  it('keeps nested precedence and does not mutate either layer', () => {
    const base = { fonts: { family: 'Base', sizes: { title: 30 } } };
    const override = { fonts: { family: 'Override' } };
    expect(mergeThemeConfig(base, override)).toEqual({
      fonts: { family: 'Override', sizes: { title: 30 } },
    });
    expect(base.fonts.sizes.title).toBe(30);
    expect(mergeThemeConfig(base, undefined)).toBe(base);
  });
});
