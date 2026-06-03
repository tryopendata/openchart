import { describe, expect, it } from 'vitest';
import { contrastRatio, findAccessibleColor, meetsAA, pickLabelColor } from '../contrast';

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

describe('pickLabelColor', () => {
  it('returns white for dark backgrounds', () => {
    expect(pickLabelColor('#1a1a2e')).toBe('#ffffff');
    expect(pickLabelColor('#2563eb')).toBe('#ffffff');
    expect(pickLabelColor('#000000')).toBe('#ffffff');
  });

  it('returns dark for light backgrounds', () => {
    expect(pickLabelColor('#ffffff')).toBe('#111111');
    expect(pickLabelColor('#f0f0f0')).toBe('#111111');
    expect(pickLabelColor('#e2e8f0')).toBe('#111111');
  });

  it('returns white for saturated mid-tone fills below the luminance threshold', () => {
    // Slate / mid-tone bar fills: WCAG body-text contrast says dark, but bold
    // value labels read cleaner in white. These all sit below L=0.42.
    expect(pickLabelColor('#94a3b8')).toBe('#ffffff'); // slate-400, L≈0.36
    expect(pickLabelColor('#64748b')).toBe('#ffffff'); // slate-500
    expect(pickLabelColor('#999999')).toBe('#ffffff'); // mid grey, L≈0.32
    expect(pickLabelColor('#e24b4a')).toBe('#ffffff'); // red
    expect(pickLabelColor('#d97706')).toBe('#ffffff'); // amber
  });

  it('returns dark for genuinely light fills above the luminance threshold', () => {
    expect(pickLabelColor('#cbd5e1')).toBe('#111111'); // slate-300
    expect(pickLabelColor('#bbbbbb')).toBe('#111111');
    expect(pickLabelColor('#dddddd')).toBe('#111111');
  });

  it('pivots mid-tone fills to dark text in dark mode (lower threshold)', () => {
    // Simultaneous contrast: a mid-tone bar looks lighter on a dark canvas,
    // so dark text reads more grounded. Dark mode uses a stricter threshold.
    expect(pickLabelColor('#94a3b8', true)).toBe('#111111'); // slate-400
    expect(pickLabelColor('#06b6d4', true)).toBe('#111111'); // cyan
    expect(pickLabelColor('#999999', true)).toBe('#111111'); // mid grey
    // Light mode keeps white on these same fills.
    expect(pickLabelColor('#94a3b8', false)).toBe('#ffffff');
    expect(pickLabelColor('#06b6d4', false)).toBe('#ffffff');
  });

  it('keeps white on saturated fills even in dark mode', () => {
    // Saturated palette colors sit below the dark-mode threshold too.
    expect(pickLabelColor('#c0392b', true)).toBe('#ffffff'); // red
    expect(pickLabelColor('#2563eb', true)).toBe('#ffffff'); // blue
    expect(pickLabelColor('#7c3aed', true)).toBe('#ffffff'); // violet
  });
});
