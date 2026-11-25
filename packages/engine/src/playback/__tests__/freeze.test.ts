import type { ChartSpec, DataRow } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { compileChartPlayback } from '../chart-playback';
import { buildEnvelopeSpec, freezeChartFrame } from '../freeze';
import { bubbleMatrix, bubbleRows, bubbleSpec, compileOptions, staticSpec } from './chart-fixtures';

/** Avalon without its 2001 row: an interior gap on every channel. */
function rowsWithGap(): DataRow[] {
  return bubbleRows().filter((row) => !(row.country === 'Avalon' && row.year === 2001));
}

describe('buildEnvelopeSpec', () => {
  it('holds one row per present cell, with statics, and drops time and playback', () => {
    const spec = bubbleSpec(bubbleRows(), { playback: { duration: 9000 } });
    const envelope = buildEnvelopeSpec(spec, bubbleMatrix());
    expect(envelope.data).toHaveLength(12);
    expect(envelope.encoding).not.toHaveProperty('time');
    expect(envelope).not.toHaveProperty('playback');
    const cydonia2002 = (envelope.data as DataRow[]).find(
      (row) => row.country === 'Cydonia' && Number(row.year) === 2002,
    );
    expect(cydonia2002).toMatchObject({ region: 'South', gdp: 9000, life: 74, pop: 9_000_000 });
  });

  it('includes interpolated cells, geometric on the log channel', () => {
    const rows = rowsWithGap();
    const envelope = buildEnvelopeSpec(bubbleSpec(rows), bubbleMatrix(rows));
    const filled = (envelope.data as DataRow[]).find(
      (row) => row.country === 'Avalon' && Number(row.year) === 2001,
    );
    // gdp 120 -> 1500 on a log axis: sqrt(120 * 1500). life 50 -> 60 linearly.
    expect(Number(filled?.gdp)).toBeCloseTo(Math.sqrt(120 * 1500), 6);
    expect(Number(filled?.life)).toBeCloseTo(55, 6);
  });

  it('leaves dropped cells out', () => {
    const rows = rowsWithGap();
    const envelope = buildEnvelopeSpec(bubbleSpec(rows), bubbleMatrix(rows, 'drop'));
    expect(envelope.data).toHaveLength(11);
    expect(
      (envelope.data as DataRow[]).some(
        (row) => row.country === 'Avalon' && Number(row.year) === 2001,
      ),
    ).toBe(false);
  });
});

describe('freezeChartFrame', () => {
  it('keeps the non-mark layout and no marks', () => {
    const frame = freezeChartFrame(bubbleSpec(), compileOptions, bubbleMatrix());
    expect(frame.layout.marks).toEqual([]);
    expect(frame.chartArea).toEqual(frame.layout.area);
    expect(frame.theme).toBe(frame.layout.theme);
  });

  it('takes axes from all periods with nice rounding, log ticks at powers of ten', () => {
    const spec = bubbleSpec();
    const frame = freezeChartFrame(spec, compileOptions, bubbleMatrix());
    const allPeriods = compileChart(staticSpec(spec), compileOptions);
    expect(frame.scales.x?.scale.domain()).toEqual([100, 10000]);
    expect(frame.layout.axes.x?.ticks.map((tick) => tick.value)).toEqual([100, 1000, 10000]);
    expect(frame.layout.axes.y?.ticks.map((tick) => tick.value)).toEqual(
      allPeriods.axes.y?.ticks.map((tick) => tick.value),
    );
  });

  it('keeps an authored scale.domain', () => {
    const spec = bubbleSpec();
    const encoding = {
      ...spec.encoding,
      x: {
        field: 'gdp',
        type: 'quantitative' as const,
        scale: { type: 'log' as const, domain: [10, 100000] },
      },
      y: { field: 'life', type: 'quantitative' as const, scale: { domain: [0, 100] } },
    };
    const frame = freezeChartFrame({ ...spec, encoding }, compileOptions, bubbleMatrix());
    expect(frame.scales.x?.scale.domain()).toEqual([10, 100000]);
    expect(frame.scales.y?.scale.domain()).toEqual([0, 100]);
  });

  it('gives the color scale every category, including one present in only some periods', () => {
    const rows = [
      ...bubbleRows(),
      { country: 'Erewhon', region: 'Island', year: 2002, gdp: 700, life: 58, pop: 500_000 },
    ];
    const frame = freezeChartFrame(bubbleSpec(rows), compileOptions, bubbleMatrix(rows));
    expect(frame.scales.color?.scale.domain()).toEqual(
      expect.arrayContaining(['North', 'South', 'Island']),
    );
  });

  it('resolves one formatter per numeric field', () => {
    const frame = freezeChartFrame(bubbleSpec(), compileOptions, bubbleMatrix());
    for (const field of ['gdp', 'life', 'pop']) {
      expect(typeof frame.formatters[field]).toBe('function');
      expect(typeof frame.formatters[field](1234)).toBe('string');
    }
  });
});

describe('freezeChartFrame with stacked bars', () => {
  /** Sales by `team|quarter` per year: Q1 stacks to 40 then 25, Q2 to 20 then 55. */
  const SALES: Record<string, number[]> = {
    'A|Q1': [10, 20],
    'B|Q1': [30, 5],
    'A|Q2': [15, 15],
    'B|Q2': [5, 40],
  };

  function salesRows(extra: DataRow[] = []): DataRow[] {
    const rows = Object.entries(SALES).flatMap(([key, byYear]) => {
      const [team, quarter] = key.split('|');
      return byYear.map((sales, period) => ({ team, quarter, year: 2000 + period, sales }));
    });
    return [...rows, ...extra];
  }

  function stackedSpec(
    rows: DataRow[],
    stack: unknown,
    orient: 'vertical' | 'horizontal' = 'vertical',
  ): ChartSpec {
    const category = { field: 'quarter', type: 'nominal' };
    const value = { field: 'sales', type: 'quantitative', stack };
    return {
      mark: 'bar',
      data: rows,
      encoding: {
        ...(orient === 'vertical' ? { x: category, y: value } : { y: category, x: value }),
        color: { field: 'team', type: 'nominal' },
        time: { field: 'year', type: 'temporal' },
      },
    } as ChartSpec;
  }

  function valueDomain(spec: ChartSpec, channel: 'x' | 'y' = 'y'): number[] {
    const { frame } = compileChartPlayback(spec, compileOptions);
    return frame.scales[channel]?.scale.domain().map(Number) ?? [];
  }

  /** The domain when every period repeats 2001, the year with the tallest stack. */
  function tallestYearDomain(spec: ChartSpec, channel: 'x' | 'y'): number[] {
    const rows = (spec.data as DataRow[]).filter((row) => row.year === 2001);
    const repeated = [...rows, ...rows.map((row) => ({ ...row, year: 2002 }))];
    return valueDomain({ ...spec, data: repeated }, channel);
  }

  it.each([
    ['vertical', true, 'y'],
    ['horizontal', 'zero', 'x'],
  ] as const)('sizes a %s stack for its tallest single-period stack', (orient, stack, channel) => {
    const spec = stackedSpec(salesRows(), stack, orient);
    const domain = valueDomain(spec, channel);
    expect(domain).toEqual(tallestYearDomain(spec, channel));
    expect(domain[1]).toBeGreaterThanOrEqual(55);
    expect(domain[1]).toBeLessThan(65);
  });

  it('keeps a team that only appears outside the tallest period in the color scale', () => {
    const rows = salesRows([{ team: 'C', quarter: 'Q2', year: 2000, sales: 1 }]);
    const { frame } = compileChartPlayback(stackedSpec(rows, true), compileOptions);
    expect(frame.scales.color?.scale.domain()).toEqual(['A', 'B', 'C']);
  });

  it('keeps a negative value from another period on the axis', () => {
    const rows = salesRows([{ team: 'C', quarter: 'Q2', year: 2000, sales: -30 }]);
    const [low] = valueDomain(stackedSpec(rows, true));
    expect(low).toBeLessThanOrEqual(-30);
  });

  it('leaves grouped bars sized for the largest single value of any period', () => {
    expect(valueDomain(stackedSpec(salesRows(), false))[1]).toBe(40);
  });
});
