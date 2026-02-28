import { describe, expect, it } from 'vitest';
import { getBreakpoint, getLayoutStrategy } from '../breakpoints';

describe('getBreakpoint', () => {
  it('returns compact for widths below 400', () => {
    expect(getBreakpoint(320)).toBe('compact');
    expect(getBreakpoint(399)).toBe('compact');
  });

  it('returns medium for widths 400-700', () => {
    expect(getBreakpoint(400)).toBe('medium');
    expect(getBreakpoint(550)).toBe('medium');
    expect(getBreakpoint(700)).toBe('medium');
  });

  it('returns full for widths above 700', () => {
    expect(getBreakpoint(701)).toBe('full');
    expect(getBreakpoint(1200)).toBe('full');
  });

  it('handles edge cases', () => {
    expect(getBreakpoint(0)).toBe('compact');
    expect(getBreakpoint(5000)).toBe('full');
  });
});

describe('getLayoutStrategy', () => {
  it('compact has no labels and minimal axes', () => {
    const strategy = getLayoutStrategy('compact');
    expect(strategy.labelMode).toBe('none');
    expect(strategy.legendPosition).toBe('top');
    expect(strategy.annotationPosition).toBe('tooltip-only');
    expect(strategy.axisLabelDensity).toBe('minimal');
  });

  it('medium has important labels and reduced axes', () => {
    const strategy = getLayoutStrategy('medium');
    expect(strategy.labelMode).toBe('important');
    expect(strategy.legendPosition).toBe('top');
    expect(strategy.annotationPosition).toBe('inline');
    expect(strategy.axisLabelDensity).toBe('reduced');
  });

  it('full has all labels and legend on right', () => {
    const strategy = getLayoutStrategy('full');
    expect(strategy.labelMode).toBe('all');
    expect(strategy.legendPosition).toBe('right');
    expect(strategy.annotationPosition).toBe('inline');
    expect(strategy.axisLabelDensity).toBe('full');
  });

  it('different widths produce different strategies', () => {
    const compact = getLayoutStrategy(getBreakpoint(320));
    const full = getLayoutStrategy(getBreakpoint(800));
    expect(compact.legendPosition).not.toBe(full.legendPosition);
    expect(compact.labelMode).not.toBe(full.labelMode);
  });
});
