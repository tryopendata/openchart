/**
 * Color blindness simulation and palette distinguishability checks.
 *
 * Uses Brettel, Vienot, and Mollon (1997) simulation matrices for
 * protanopia, deuteranopia, and tritanopia.
 *
 * These are approximations suitable for checking palette accessibility,
 * not medical-grade simulations.
 */

import { rgb } from 'd3-color';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four common types of color vision deficiency. */
export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

// ---------------------------------------------------------------------------
// Simulation matrices
// ---------------------------------------------------------------------------

// 3x3 color transformation matrices for each deficiency type.
// Applied in linear RGB space to simulate how colors appear.
// Source: Brettel, Vienot & Mollon (1997), simplified.

type Matrix3x3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const PROTAN_MATRIX: Matrix3x3 = [
  [0.567, 0.433, 0.0],
  [0.558, 0.442, 0.0],
  [0.0, 0.242, 0.758],
];

const DEUTAN_MATRIX: Matrix3x3 = [
  [0.625, 0.375, 0.0],
  [0.7, 0.3, 0.0],
  [0.0, 0.3, 0.7],
];

const TRITAN_MATRIX: Matrix3x3 = [
  [0.95, 0.05, 0.0],
  [0.0, 0.433, 0.567],
  [0.0, 0.475, 0.525],
];

// Total color blindness: every channel collapses to Rec. 709 relative
// luminance, computed in linear RGB like the other matrices.
const ACHROMAT_MATRIX: Matrix3x3 = [
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722],
];

const MATRICES: Record<ColorBlindnessType, Matrix3x3> = {
  protanopia: PROTAN_MATRIX,
  deuteranopia: DEUTAN_MATRIX,
  tritanopia: TRITAN_MATRIX,
  achromatopsia: ACHROMAT_MATRIX,
};

// ---------------------------------------------------------------------------
// sRGB linearization helpers
// ---------------------------------------------------------------------------

function linearize(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function delinearize(v: number): number {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Simulate how a color appears under a given color blindness type.
 * Returns a hex color string.
 */
export function simulateColorBlindness(color: string, type: ColorBlindnessType): string {
  const c = rgb(color);
  if (c == null) return color;

  const lin = [linearize(c.r), linearize(c.g), linearize(c.b)];
  const m = MATRICES[type];

  const r = m[0][0] * lin[0] + m[0][1] * lin[1] + m[0][2] * lin[2];
  const g = m[1][0] * lin[0] + m[1][1] * lin[1] + m[1][2] * lin[2];
  const b = m[2][0] * lin[0] + m[2][1] * lin[1] + m[2][2] * lin[2];

  return rgb(delinearize(r), delinearize(g), delinearize(b)).formatHex();
}

/**
 * Check if colors in a palette are distinguishable under a given
 * color blindness type.
 *
 * Uses a minimum perceptual distance threshold in simulated space.
 * Returns true if all pairs of colors are sufficiently different.
 */
export function checkPaletteDistinguishability(
  colors: string[],
  type: ColorBlindnessType,
  minDistance = 30,
): boolean {
  const simulated = colors.map((c) => {
    const s = rgb(simulateColorBlindness(c, type));
    return s ? [s.r, s.g, s.b] : [0, 0, 0];
  });

  for (let i = 0; i < simulated.length; i++) {
    for (let j = i + 1; j < simulated.length; j++) {
      const dr = simulated[i][0] - simulated[j][0];
      const dg = simulated[i][1] - simulated[j][1];
      const db = simulated[i][2] - simulated[j][2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < minDistance) return false;
    }
  }

  return true;
}
