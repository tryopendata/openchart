import { describe, expect, it } from 'vitest';
import {
  getBreakpoint,
  getHeightClass,
  getLayoutStrategy,
  resolveChromeEconomy,
} from '../breakpoints';

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

  it('full has all labels and legend on top', () => {
    const strategy = getLayoutStrategy('full');
    expect(strategy.labelMode).toBe('all');
    expect(strategy.legendPosition).toBe('top');
    expect(strategy.annotationPosition).toBe('inline');
    expect(strategy.axisLabelDensity).toBe('full');
  });

  it('puts the legend on top at every breakpoint', () => {
    // The responsive strategy no longer varies legend position by width; a
    // top legend reads as a key before the eye reaches the plot and keeps the
    // plotting area full-width. `legend.position` overrides it per spec.
    for (const breakpoint of ['compact', 'medium', 'full'] as const) {
      expect(getLayoutStrategy(breakpoint).legendPosition).toBe('top');
    }
  });

  it('different widths produce different strategies', () => {
    const compact = getLayoutStrategy(getBreakpoint(320));
    const full = getLayoutStrategy(getBreakpoint(800));
    // Legend position is deliberately uniform across breakpoints, so the
    // width-sensitive fields are labels and axis density.
    expect(compact.labelMode).not.toBe(full.labelMode);
    expect(compact.axisLabelDensity).not.toBe(full.axisLabelDensity);
  });

  it('includes chromeMode and legendMaxHeight at normal height', () => {
    const strategy = getLayoutStrategy('full');
    expect(strategy.chromeMode).toBe('full');
    expect(strategy.legendMaxHeight).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// Height class detection
// ---------------------------------------------------------------------------

describe('getHeightClass', () => {
  it('returns cramped for heights below 200', () => {
    expect(getHeightClass(100)).toBe('cramped');
    expect(getHeightClass(199)).toBe('cramped');
  });

  it('returns short for heights 200-350', () => {
    expect(getHeightClass(200)).toBe('short');
    expect(getHeightClass(280)).toBe('short');
    expect(getHeightClass(350)).toBe('short');
  });

  it('returns normal for heights above 350', () => {
    expect(getHeightClass(351)).toBe('normal');
    expect(getHeightClass(800)).toBe('normal');
  });

  it('handles edge cases', () => {
    expect(getHeightClass(0)).toBe('cramped');
    expect(getHeightClass(-10)).toBe('cramped');
    expect(getHeightClass(5000)).toBe('normal');
  });
});

// ---------------------------------------------------------------------------
// Height-aware layout strategy
// ---------------------------------------------------------------------------

describe('getLayoutStrategy with height class', () => {
  it('normal height does not modify the width strategy', () => {
    const withoutHeight = getLayoutStrategy('full');
    const withNormal = getLayoutStrategy('full', 'normal');
    expect(withoutHeight).toEqual(withNormal);
  });

  it('cramped height hides chrome and labels', () => {
    const strategy = getLayoutStrategy('full', 'cramped');
    expect(strategy.chromeMode).toBe('hidden');
    expect(strategy.legendMaxHeight).toBe(0);
    expect(strategy.labelMode).toBe('none');
    expect(strategy.annotationPosition).toBe('tooltip-only');
  });

  it('cramped overrides even compact width strategy', () => {
    const strategy = getLayoutStrategy('compact', 'cramped');
    expect(strategy.chromeMode).toBe('hidden');
    expect(strategy.legendMaxHeight).toBe(0);
    expect(strategy.labelMode).toBe('none');
  });

  it('short height compresses chrome and caps legend', () => {
    const strategy = getLayoutStrategy('full', 'short');
    expect(strategy.chromeMode).toBe('compact');
    expect(strategy.legendMaxHeight).toBe(0.15);
  });

  it('short height preserves width-based label and legend settings', () => {
    const strategy = getLayoutStrategy('full', 'short');
    // Width strategy for 'full' sets these; short only touches chromeMode and legendMaxHeight
    expect(strategy.labelMode).toBe('all');
    expect(strategy.legendPosition).toBe('top');
    expect(strategy.axisLabelDensity).toBe('full');
  });

  it('short height preserves compact width label settings', () => {
    const strategy = getLayoutStrategy('compact', 'short');
    expect(strategy.labelMode).toBe('none');
    expect(strategy.legendPosition).toBe('top');
    expect(strategy.chromeMode).toBe('compact');
  });

  it('defaults heightClass to normal when omitted', () => {
    const strategy = getLayoutStrategy('medium');
    expect(strategy.chromeMode).toBe('full');
    expect(strategy.legendMaxHeight).toBe(-1);
  });
});

describe('resolveChromeEconomy', () => {
  it('drops gridlines and axes and caps x ticks on a tiny tile', () => {
    expect(resolveChromeEconomy(300, 140)).toEqual({
      gridlines: false,
      axes: false,
      maxXTicks: 3,
    });
  });

  it('keeps gridlines but drops axes between the two thresholds', () => {
    const economy = resolveChromeEconomy(700, 180);
    expect(economy.gridlines).toBe(true);
    expect(economy.axes).toBe(false);
  });

  it('leaves a normal embed alone', () => {
    expect(resolveChromeEconomy(700, 180).maxXTicks).toBeUndefined();
    const full = resolveChromeEconomy(700, 400);
    expect(full).toEqual({ gridlines: true, axes: true });
  });

  it('caps x ticks at compact width regardless of height', () => {
    expect(resolveChromeEconomy(320, 400).maxXTicks).toBe(3);
    expect(resolveChromeEconomy(400, 400).maxXTicks).toBeUndefined();
  });
});
