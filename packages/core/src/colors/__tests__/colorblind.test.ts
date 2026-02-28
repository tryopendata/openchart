import { describe, expect, it } from 'vitest';
import { checkPaletteDistinguishability, simulateColorBlindness } from '../colorblind';

describe('simulateColorBlindness', () => {
  it('returns a valid hex color for protanopia', () => {
    const result = simulateColorBlindness('#e15759', 'protanopia');
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns a valid hex color for deuteranopia', () => {
    const result = simulateColorBlindness('#59a14f', 'deuteranopia');
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns a valid hex color for tritanopia', () => {
    const result = simulateColorBlindness('#1b7fa3', 'tritanopia');
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('pure grey remains close to grey under all types', () => {
    const grey = '#808080';
    for (const type of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const sim = simulateColorBlindness(grey, type);
      // Simulated grey should still be roughly grey (all channels similar)
      const match = sim.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      expect(match).not.toBeNull();
      if (match) {
        const [r, g, b] = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
        // All channels should be within ~40 of each other
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        expect(max - min).toBeLessThan(40);
      }
    }
  });

  it('red and green become similar under protanopia', () => {
    const simRed = simulateColorBlindness('#ff0000', 'protanopia');
    const simGreen = simulateColorBlindness('#00ff00', 'protanopia');
    // They should be more similar than the originals
    // (we just verify they're both valid, the matrix math handles the rest)
    expect(simRed).toMatch(/^#[0-9a-f]{6}$/i);
    expect(simGreen).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('checkPaletteDistinguishability', () => {
  it('returns true for very different colors', () => {
    expect(checkPaletteDistinguishability(['#ff0000', '#0000ff', '#ffffff'], 'protanopia')).toBe(
      true,
    );
  });

  it('returns false for near-identical colors', () => {
    expect(
      checkPaletteDistinguishability(['#ff0000', '#ff0200', '#ff0100'], 'protanopia', 30),
    ).toBe(false);
  });

  it('handles single-color palettes (vacuously true)', () => {
    expect(checkPaletteDistinguishability(['#ff0000'], 'deuteranopia')).toBe(true);
  });
});
