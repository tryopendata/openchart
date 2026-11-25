import type { DataRow } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
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
