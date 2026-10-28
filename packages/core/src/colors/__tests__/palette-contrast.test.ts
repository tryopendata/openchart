import { lab } from 'd3-color';
import { describe, expect, it } from 'vitest';
import { adaptTheme } from '../../theme/dark-mode';
import { resolveTheme } from '../../theme/resolve';
import { contrastRatio } from '../contrast';
import {
  ACHROMATIC_RAMP,
  CATEGORICAL_FILL_PALETTE,
  CATEGORICAL_FILL_PALETTE_DARK,
  CATEGORICAL_PALETTE,
  CATEGORICAL_PALETTE_DARK,
} from '../palettes';

const light = resolveTheme();
const dark = adaptTheme(resolveTheme());

// The default background is transparent: check the resolved opaque surface
// and both host surfaces rather than treating transparency as black.
const modes = [
  {
    name: 'light',
    palettes: [CATEGORICAL_PALETTE, CATEGORICAL_FILL_PALETTE],
    surfaces: ['#ffffff', '#fafafa', light.colors.neutral.surface],
  },
  {
    name: 'dark',
    palettes: [CATEGORICAL_PALETTE_DARK, CATEGORICAL_FILL_PALETTE_DARK],
    surfaces: [ACHROMATIC_RAMP.bg, ACHROMATIC_RAMP.card, dark.colors.neutral.surface],
  },
];

describe('default categorical contrast', () => {
  for (const { name, palettes, surfaces } of modes) {
    for (const [index, palette] of palettes.entries()) {
      for (const surface of new Set(surfaces)) {
        it(`${name} ${index === 0 ? 'strokes' : 'fills'} clear 3:1 on ${surface}`, () => {
          for (const color of palette) {
            expect(contrastRatio(color, surface), color).toBeGreaterThanOrEqual(3);
          }
        });
      }
    }
  }

  it('retuned cyan, ochre and violet retain 3.2:1 headroom on near-white', () => {
    for (const palette of [CATEGORICAL_PALETTE, CATEGORICAL_FILL_PALETTE]) {
      for (const slot of [0, 1, 5]) {
        expect(contrastRatio(palette[slot], '#fafafa'), palette[slot]).toBeGreaterThanOrEqual(3.2);
      }
    }
  });

  it('light palette neighbors retain CIELAB delta E of at least 20, including the wrap', () => {
    for (const palette of [CATEGORICAL_PALETTE, CATEGORICAL_FILL_PALETTE]) {
      for (let i = 0; i < palette.length; i++) {
        const a = lab(palette[i]);
        const b = lab(palette[(i + 1) % palette.length]);
        const distance = Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
        expect(
          distance,
          `${palette[i]} / ${palette[(i + 1) % palette.length]}`,
        ).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('resolved theme fills and strokes use their respective retuned palettes', () => {
    expect(light.colors.categorical).toEqual(CATEGORICAL_PALETTE);
    expect(light.colors.categoricalFill).toEqual(CATEGORICAL_FILL_PALETTE);
    expect(dark.colors.categorical).toEqual(CATEGORICAL_PALETTE_DARK);
    expect(dark.colors.categoricalFill).toEqual(CATEGORICAL_FILL_PALETTE_DARK);
  });
});
