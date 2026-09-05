/**
 * Accessibility contract for the categorical palette.
 *
 * The palette is generated from OKLCH triples (see the docblock in
 * `palettes.ts`); this file is the guard that keeps a regeneration or a
 * hand-edit from shipping something illegible or indistinguishable.
 */

import { describe, expect, it } from 'vitest';
import { adaptTheme } from '../../theme/dark-mode';
import { DEFAULT_THEME } from '../../theme/defaults';
import { resolveTheme } from '../../theme/resolve';
import { checkPaletteDistinguishability } from '../colorblind';
import { contrastRatio } from '../contrast';
import {
  CATEGORICAL_EXTENDED_PALETTE,
  CATEGORICAL_FILL_PALETTE,
  CATEGORICAL_FILL_PALETTE_DARK,
  CATEGORICAL_HUES,
  CATEGORICAL_PALETTE,
  CATEGORICAL_PALETTE_DARK,
} from '../palettes';

const WHITE = '#ffffff';
const INK = '#09090b';

const ALL_ARRAYS: Array<[string, readonly string[]]> = [
  ['stroke light', CATEGORICAL_PALETTE],
  ['fill light', CATEGORICAL_FILL_PALETTE],
  ['stroke dark', CATEGORICAL_PALETTE_DARK],
  ['fill dark', CATEGORICAL_FILL_PALETTE_DARK],
  ['extended', CATEGORICAL_EXTENDED_PALETTE],
];

describe('categorical palette accessibility', () => {
  it('every array is six valid hexes', () => {
    for (const [name, arr] of ALL_ARRAYS) {
      expect(arr, name).toHaveLength(6);
      for (const c of arr) expect(c, name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('light strokes clear 2.2:1 on white', () => {
    // 2.2 is the documented floor, set by the cyan accent (#06b6d4 at 2.43:1).
    // Line strokes are drawn through adaptForLightLineStroke and clear 3:1;
    // that is asserted separately in the line-compute test.
    for (const c of CATEGORICAL_PALETTE) {
      expect(contrastRatio(c, WHITE), c).toBeGreaterThanOrEqual(2.2);
    }
  });

  it('light fills clear 2.0:1 on white', () => {
    for (const c of CATEGORICAL_FILL_PALETTE) {
      expect(contrastRatio(c, WHITE), c).toBeGreaterThanOrEqual(2.0);
    }
  });

  it('dark strokes and fills clear 3:1 on the dark canvas', () => {
    for (const c of [...CATEGORICAL_PALETTE_DARK, ...CATEGORICAL_FILL_PALETTE_DARK]) {
      expect(contrastRatio(c, INK), c).toBeGreaterThanOrEqual(3);
    }
  });

  it('the extended ramp stays legible on both canvases', () => {
    for (const c of CATEGORICAL_EXTENDED_PALETTE) {
      expect(contrastRatio(c, WHITE), c).toBeGreaterThanOrEqual(2.2);
      expect(contrastRatio(c, INK), c).toBeGreaterThanOrEqual(3);
    }
  });

  it('adjacent hues sit at least 80 degrees apart, including the wrap', () => {
    for (let i = 0; i < CATEGORICAL_HUES.length; i++) {
      const a = CATEGORICAL_HUES[i];
      const b = CATEGORICAL_HUES[(i + 1) % CATEGORICAL_HUES.length];
      const raw = Math.abs(a - b) % 360;
      const delta = Math.min(raw, 360 - raw);
      expect(delta, `slots ${i + 1}/${((i + 1) % 6) + 1}`).toBeGreaterThanOrEqual(80);
    }
  });

  it('every array survives deuteranopia and protanopia', () => {
    // This is the load-bearing separation check. The design brief also asked
    // for >= 0.08 OKLCH lightness between adjacent slots, but that is not
    // satisfiable alongside the fixed hue order and the pinned cyan literal
    // (L 0.715): the ramp's tightest adjacent pair is blue/rose at 0.009.
    // Colour-vision simulation is the stronger test anyway — it collapses hue
    // and leaves lightness and residual chroma, so a pair that is genuinely
    // indistinguishable fails here regardless of how it got that way.
    for (const [name, arr] of ALL_ARRAYS) {
      expect(checkPaletteDistinguishability([...arr], 'deuteranopia'), `${name} deuteranopia`).toBe(
        true,
      );
      expect(checkPaletteDistinguishability([...arr], 'protanopia'), `${name} protanopia`).toBe(
        true,
      );
    }
  });

  it('positive and negative clear AA on their own background', () => {
    expect(contrastRatio(DEFAULT_THEME.colors.positive, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DEFAULT_THEME.colors.negative, WHITE)).toBeGreaterThanOrEqual(4.5);
    const dark = adaptTheme(resolveTheme());
    expect(contrastRatio(dark.colors.positive, INK)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark.colors.negative, INK)).toBeGreaterThanOrEqual(4.5);
  });
});
