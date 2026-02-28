import { describe, expect, it } from 'vitest';
import { estimateTextHeight, estimateTextWidth } from '../text-measure';

describe('estimateTextWidth', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTextWidth('', 14)).toBe(0);
  });

  it('scales linearly with text length', () => {
    const w5 = estimateTextWidth('hello', 14);
    const w10 = estimateTextWidth('helloworld', 14);
    expect(w10).toBeCloseTo(w5 * 2, 1);
  });

  it('scales with font size', () => {
    const w14 = estimateTextWidth('test', 14);
    const w28 = estimateTextWidth('test', 28);
    expect(w28).toBeCloseTo(w14 * 2, 1);
  });

  it('heavier weights produce wider estimates', () => {
    const normal = estimateTextWidth('test', 14, 400);
    const bold = estimateTextWidth('test', 14, 700);
    expect(bold).toBeGreaterThan(normal);
  });

  it('produces reasonable values for common cases', () => {
    // "GDP Growth Rate" at 18px should be roughly 120-180px wide
    const width = estimateTextWidth('GDP Growth Rate', 18);
    expect(width).toBeGreaterThan(100);
    expect(width).toBeLessThan(250);
  });
});

describe('estimateTextHeight', () => {
  it('single line at 14px with 1.3 lineHeight is 18.2', () => {
    expect(estimateTextHeight(14, 1, 1.3)).toBeCloseTo(18.2, 1);
  });

  it('two lines are double the height', () => {
    const h1 = estimateTextHeight(14, 1);
    const h2 = estimateTextHeight(14, 2);
    expect(h2).toBeCloseTo(h1 * 2, 1);
  });

  it('defaults to 1 line and 1.3 lineHeight', () => {
    expect(estimateTextHeight(10)).toBeCloseTo(13, 1);
  });
});
