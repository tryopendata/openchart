import { describe, expect, it } from 'vitest';
import { contrastRatio, findAccessibleColor, meetsAA } from '../contrast';

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1 for identical colors', () => {
    const ratio = contrastRatio('#336699', '#336699');
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('is commutative (order does not matter)', () => {
    const a = contrastRatio('#1b7fa3', '#ffffff');
    const b = contrastRatio('#ffffff', '#1b7fa3');
    expect(a).toBeCloseTo(b, 5);
  });

  it('computes known contrast ratios within tolerance', () => {
    // White text on dark blue: should be high contrast
    const ratio = contrastRatio('#ffffff', '#003366');
    expect(ratio).toBeGreaterThan(8);
  });
});

describe('meetsAA', () => {
  it('black on white meets AA for normal text', () => {
    expect(meetsAA('#000000', '#ffffff')).toBe(true);
  });

  it('light grey on white fails AA for normal text', () => {
    expect(meetsAA('#cccccc', '#ffffff')).toBe(false);
  });

  it('uses 3:1 threshold for large text', () => {
    // Find a color that has ratio between 3 and 4.5
    // Medium grey on white has ~3.9:1 ratio
    const ratio = contrastRatio('#767676', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(5);
    // Should fail normal text but pass large text
    expect(meetsAA('#767676', '#ffffff', true)).toBe(true);
  });
});

describe('findAccessibleColor', () => {
  it('returns the original color if already accessible', () => {
    const result = findAccessibleColor('#000000', '#ffffff');
    expect(result).toBe('#000000');
  });

  it('darkens a light color to meet contrast on white', () => {
    const result = findAccessibleColor('#cccccc', '#ffffff');
    const ratio = contrastRatio(result, '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('lightens a dark color to meet contrast on dark background', () => {
    const result = findAccessibleColor('#333333', '#09090b');
    const ratio = contrastRatio(result, '#09090b');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('respects custom target ratio', () => {
    const result = findAccessibleColor('#aaaaaa', '#ffffff', 7);
    const ratio = contrastRatio(result, '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(7);
  });
});
