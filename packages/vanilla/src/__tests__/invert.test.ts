import { describe, expect, it } from 'vitest';
import { invertScale } from '../interactions/invert';

describe('invertScale', () => {
  describe('continuous (linear interpolation)', () => {
    it('returns midpoint data value for midpoint pixel', () => {
      const result = invertScale(
        { topPixel: 0, bottomPixel: 400, topData: 0, bottomData: 100 },
        200,
      );
      expect(result).toBe(50);
    });

    it('returns topData at topPixel', () => {
      const result = invertScale({ topPixel: 0, bottomPixel: 400, topData: 0, bottomData: 100 }, 0);
      expect(result).toBe(0);
    });

    it('returns bottomData at bottomPixel', () => {
      const result = invertScale(
        { topPixel: 0, bottomPixel: 400, topData: 0, bottomData: 100 },
        400,
      );
      expect(result).toBe(100);
    });

    it('handles inverted y-axis (topData > bottomData)', () => {
      const result = invertScale(
        { topPixel: 50, bottomPixel: 350, topData: 100, bottomData: 0 },
        200,
      );
      expect(result).toBe(50);
    });

    it('returns topData when span is zero', () => {
      const result = invertScale(
        { topPixel: 100, bottomPixel: 100, topData: 42, bottomData: 99 },
        100,
      );
      expect(result).toBe(42);
    });

    it('extrapolates beyond range', () => {
      const result = invertScale(
        { topPixel: 0, bottomPixel: 200, topData: 0, bottomData: 100 },
        400,
      );
      expect(result).toBe(200);
    });
  });

  describe('band/point (snap to nearest)', () => {
    it('snaps to nearest domain value', () => {
      const result = invertScale(
        {
          topPixel: 0,
          bottomPixel: 300,
          topData: 0,
          bottomData: 0,
          domain: ['A', 'B', 'C'],
          positions: [50, 150, 250],
        },
        140,
      );
      expect(result).toBe('B');
    });

    it('snaps to first value when pixel is before all positions', () => {
      const result = invertScale(
        {
          topPixel: 0,
          bottomPixel: 300,
          topData: 0,
          bottomData: 0,
          domain: ['A', 'B', 'C'],
          positions: [50, 150, 250],
        },
        0,
      );
      expect(result).toBe('A');
    });

    it('snaps to last value when pixel is after all positions', () => {
      const result = invertScale(
        {
          topPixel: 0,
          bottomPixel: 300,
          topData: 0,
          bottomData: 0,
          domain: ['A', 'B', 'C'],
          positions: [50, 150, 250],
        },
        300,
      );
      expect(result).toBe('C');
    });

    it('returns exact match on position', () => {
      const result = invertScale(
        {
          topPixel: 0,
          bottomPixel: 300,
          topData: 0,
          bottomData: 0,
          domain: ['X', 'Y', 'Z'],
          positions: [50, 150, 250],
        },
        150,
      );
      expect(result).toBe('Y');
    });

    it('handles numeric domain values', () => {
      const result = invertScale(
        {
          topPixel: 0,
          bottomPixel: 200,
          topData: 0,
          bottomData: 0,
          domain: [2020, 2021, 2022],
          positions: [33, 100, 167],
        },
        110,
      );
      expect(result).toBe(2021);
    });
  });
});
