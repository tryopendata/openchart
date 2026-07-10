import { describe, expect, it } from 'vitest';
import { bandLabelStride, resolveBandTickAngle } from '../layout/axes/rotation';

// Geometry cheat sheet at the default 11px tick font:
// - ribbon thickness = 11 * 1.2 + 4 = 17.2px (perpendicular room one label needs)
// - at -45°, ribbon separation = spacing * 0.707, so the -45 → -90 flip sits
//   near spacing ≈ 24.3px
// - at -90°, separation = spacing, so the stride safety net starts below
//   spacing ≈ 17.2px

describe('resolveBandTickAngle', () => {
  it('returns the explicit angle untouched', () => {
    expect(resolveBandTickAngle(-30, 100, 20, 5, 50, 11)).toBe(-30);
    expect(resolveBandTickAngle(0, 100, 20, 5, 50, 11)).toBe(0);
  });

  it('never rotates a single label', () => {
    expect(resolveBandTickAngle(undefined, 100, 20, 1, 50, 11)).toBeUndefined();
  });

  it('stays flat when the widest label fits its band', () => {
    expect(resolveBandTickAngle(undefined, 17, 20, 5, 30, 11)).toBeUndefined();
  });

  it('picks -45 when diagonal ribbons clear one line height', () => {
    // separation = 25 * sin45 ≈ 17.7 >= 17.2
    expect(resolveBandTickAngle(undefined, 40, 20, 5, 25, 11)).toBe(-45);
  });

  it('escalates to -90 when diagonal ribbons would touch', () => {
    // separation = 24 * sin45 ≈ 17.0 < 17.2, and 24px along-text clearance
    // cannot fit a 40px label; vertical separation 24 >= 17.2 fits.
    expect(resolveBandTickAngle(undefined, 40, 20, 5, 24, 11)).toBe(-90);
  });

  it('keeps -45 for short labels that clear end-to-end along the text direction', () => {
    // Ribbons touch (24 * sin45 < 17.2) but a 10px label clears via the
    // 17px along-text offset — finite segments slide past each other.
    expect(resolveBandTickAngle(undefined, 10, 8, 5, 24, 11)).toBe(-45);
  });

  it('refuses -90 for labels longer than the rotated-extent cap', () => {
    // A 150px label projected vertically exceeds the 120px reservation cap
    // and would clip into the source line; stay at -45 and let the stride
    // safety net thin instead.
    expect(resolveBandTickAngle(undefined, 150, 20, 5, 20, 11)).toBe(-45);
  });
});

describe('bandLabelStride', () => {
  it('returns 1 for degenerate spacing', () => {
    expect(bandLabelStride(50, -45, 11, 0)).toBe(1);
    expect(bandLabelStride(50, -45, 11, -5)).toBe(1);
  });

  it('drives the flat stride by label width', () => {
    // (50 + 4) / 20 → every 3rd label
    expect(bandLabelStride(50, undefined, 11, 20)).toBe(3);
    expect(bandLabelStride(10, undefined, 11, 20)).toBe(1);
  });

  it('keeps every label when vertical separation fits', () => {
    expect(bandLabelStride(50, -90, 11, 20)).toBe(1);
  });

  it('thins vertical labels only at tiny steps', () => {
    // separation 7 < 17.2 → ceil(17.2 / 7) = 3
    expect(bandLabelStride(50, -90, 11, 7)).toBe(3);
  });

  it('does not thin a shallow explicit angle whose labels clear end-to-end', () => {
    // labelAngle -20 at 50px spacing: ribbon separation 17.1 barely misses
    // one line height, but the 47px along-text offset clears a 30px label.
    // The old span model dropped every other label here.
    expect(bandLabelStride(30, -20, 11, 50)).toBe(1);
  });

  it('thins a shallow explicit angle when labels overlap by both routes', () => {
    // labelAngle -20 at 30px spacing with 60px labels: separation 10.3 needs
    // stride 2, along-text clearance 28.2 needs stride 3 → ribbons win.
    expect(bandLabelStride(60, -20, 11, 30)).toBe(2);
  });
});
