import type { Encoding, ResolvedTheme } from '@opendata-ai/openchart-core';
import { ACHROMATIC_RAMP, resolveTheme } from '@opendata-ai/openchart-core';
import { scaleLinear, scaleOrdinal } from 'd3-scale';
import { describe, expect, it } from 'vitest';
import type { ResolvedScales } from '../../layout/scales';
import { applyColorScaleRange } from '../color-scale-range';

const theme: ResolvedTheme = resolveTheme();
const accentNeutralTheme: ResolvedTheme = resolveTheme({
  seriesStrategy: { single: 'accent', few: 'accent-neutral', many: 'palette' },
});

describe('applyColorScaleRange', () => {
  it('is a no-op when no color scale is present', () => {
    const scales: ResolvedScales = {};
    const encoding: Encoding = {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    };
    expect(() => applyColorScaleRange(scales, encoding, theme)).not.toThrow();
    expect(scales.color).toBeUndefined();
  });

  it('does not overwrite the range when the encoding declares an explicit palette', () => {
    // computeScales has already applied the explicit palette to the scale.
    // The helper must leave it untouched (not replace it with the theme palette).
    const explicit = ['#111111', '#222222', '#333333'];
    const ordinal = scaleOrdinal<string, string>().domain(['a', 'b', 'c']).range(explicit);
    const scales: ResolvedScales = {
      color: { scale: ordinal, type: 'ordinal', channel: 'color' },
    };
    const encoding: Encoding = {
      x: { field: 'x', type: 'nominal' },
      y: { field: 'y', type: 'quantitative' },
      color: {
        field: 'c',
        type: 'nominal',
        scale: { range: explicit },
      },
    };
    applyColorScaleRange(scales, encoding, theme);
    expect(ordinal.range()).toEqual(explicit);
    expect(ordinal.range()).not.toEqual(theme.colors.categorical);
  });

  it('assigns the theme categorical palette when no range is set', () => {
    const ordinal = scaleOrdinal<string, string>().domain(['a', 'b', 'c']);
    const scales: ResolvedScales = {
      color: { scale: ordinal, type: 'ordinal', channel: 'color' },
    };
    const encoding: Encoding = {
      x: { field: 'x', type: 'nominal' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'c', type: 'nominal' },
    };
    applyColorScaleRange(scales, encoding, theme);
    expect(ordinal.range()).toEqual(theme.colors.categorical);
  });

  it('uses the first sequential palette endpoints for sequential color scales', () => {
    const linear = scaleLinear<string, string>().domain([0, 100]);
    const scales: ResolvedScales = {
      color: {
        scale: linear as unknown as ResolvedScales['color'] extends infer T
          ? T extends { scale: infer S }
            ? S
            : never
          : never,
        type: 'sequential',
        channel: 'color',
      } as NonNullable<ResolvedScales['color']>,
    };
    const encoding: Encoding = {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'v', type: 'quantitative' },
    };
    applyColorScaleRange(scales, encoding, theme);
    const firstSeq = Object.values(theme.colors.sequential)[0] ?? theme.colors.categorical;
    expect(linear.range()).toEqual([firstSeq[0], firstSeq[firstSeq.length - 1]]);
  });
});

// ---------------------------------------------------------------------------
// seriesStrategy
// ---------------------------------------------------------------------------

describe('applyColorScaleRange seriesStrategy', () => {
  function makeOrdinalScales(domain: string[]): {
    scales: ResolvedScales;
    ordinal: ReturnType<typeof scaleOrdinal<string, string>>;
  } {
    const ordinal = scaleOrdinal<string, string>().domain(domain);
    const scales: ResolvedScales = {
      color: { scale: ordinal, type: 'ordinal', channel: 'color' },
    };
    return { scales, ordinal };
  }

  const encoding: Encoding = {
    x: { field: 'x', type: 'nominal' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 'c', type: 'nominal' },
  };

  it('palette strategy assigns full categorical palette', () => {
    const { scales, ordinal } = makeOrdinalScales(['a', 'b', 'c']);
    applyColorScaleRange(scales, encoding, theme);
    expect(ordinal.range()).toEqual(theme.colors.categorical);
  });

  it('accent-neutral: single series gets accent only', () => {
    const { scales, ordinal } = makeOrdinalScales(['solo']);
    applyColorScaleRange(scales, encoding, accentNeutralTheme);
    expect(ordinal.range()).toEqual([accentNeutralTheme.colors.categorical[0]]);
  });

  it('accent-neutral: 3 series gets accent + neutral grays', () => {
    const { scales, ordinal } = makeOrdinalScales(['a', 'b', 'c']);
    applyColorScaleRange(scales, encoding, accentNeutralTheme);
    const range = ordinal.range();
    expect(range[0]).toBe(accentNeutralTheme.colors.categorical[0]);
    expect(range[1]).toBe(ACHROMATIC_RAMP.fgMuted);
    expect(range[2]).toBe(ACHROMATIC_RAMP.fgSubtle);
  });

  it('accent-neutral: 6 series falls back to full palette', () => {
    const { scales, ordinal } = makeOrdinalScales(['a', 'b', 'c', 'd', 'e', 'f']);
    applyColorScaleRange(scales, encoding, accentNeutralTheme);
    expect(ordinal.range()).toEqual(accentNeutralTheme.colors.categorical);
  });
});
