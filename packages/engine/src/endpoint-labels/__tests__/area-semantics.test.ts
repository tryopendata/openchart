import type { AreaMark, ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

function spec(stack: 'zero' | 'normalize' | 'center' = 'zero'): ChartSpec {
  return {
    mark: 'area',
    data: [
      { date: '2020-01-01', value: 10, series: 'A' },
      { date: '2021-01-01', value: 20, series: 'A' },
      { date: '2022-01-01', value: 30, series: 'A' },
      { date: '2020-01-01', value: 40, series: 'B' },
      { date: '2021-01-01', value: 50, series: 'B' },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative', stack },
      color: { field: 'series', type: 'nominal' },
    },
    endpointLabels: { anchor: 'band', ends: 'both' },
  };
}

describe('stack endpoint observation semantics', () => {
  it.each([
    'zero',
    'normalize',
    'center',
  ] as const)('anchors %s bands at observed endpoints while retaining boundary points', (stack) => {
    const layout = compileChart(spec(stack), { width: 900, height: 450 });
    const areas = layout.marks.filter((mark): mark is AreaMark => mark.type === 'area');
    const b = areas.find((mark) => mark.seriesKey === 'B')!;
    expect(b.dataPoints?.at(-1)?.observed).toBe(false);
    expect(b.dataPoints?.at(-1)?.y).toBe(b.topPoints.at(-1)?.y);
    const endpoint = layout.endpointLabels!.entries.find((entry) => entry.seriesKey === 'B')!;
    const point = b.dataPoints![1];
    expect(endpoint.source?.datum.value).toBe(50);
    expect(endpoint.source?.x).toBe('2021-01-01');
    expect(endpoint.dataY).toBe((point.y + point.yBottom!) / 2);
    expect(endpoint.marker).toBeUndefined();
    expect(endpoint.showLeader).toBe(true);
    expect(
      layout.endpointLabels!.leading?.find((entry) => entry.seriesKey === 'B')?.source?.datum.value,
    ).toBe(40);
  });

  it.each([
    null,
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('keeps invalid %s as a shared gap but preserves true observed zero', (invalid) => {
    const input = spec();
    input.data.push({ date: '2021-01-01', value: invalid, series: 'B' });
    input.data.push({ date: '2023-01-01', value: 0, series: 'B' });
    const layout = compileChart(input, { width: 900, height: 450 });
    const b = layout.marks.find(
      (mark): mark is AreaMark => mark.type === 'area' && mark.seriesKey === 'B',
    )!;
    expect(b.dataPoints?.some((point) => point.datum.date === '2021-01-01')).toBe(false);
    expect(b.dataPoints?.at(-1)?.observed).toBe(true);
    expect(
      layout.endpointLabels!.entries.find((entry) => entry.seriesKey === 'B')?.source?.datum.value,
    ).toBe(0);
  });

  it('retains numeric source observations across resize', () => {
    const input = spec('normalize');
    const observations = [390, 1024, 1440].map((width) =>
      compileChart(input, { width, height: 450 }).endpointLabels?.entries.map((entry) => [
        entry.seriesKey,
        entry.source?.x,
        entry.source?.datum.value,
        entry.value,
      ]),
    );
    expect(observations[0]).toEqual(observations[1]);
    expect(observations[1]).toEqual(observations[2]);
  });
});

it('fits names inside bands without choosing a numerical observation by available space', () => {
  const input = spec();
  input.endpointLabels = { placement: 'interior', anchor: 'band' };
  input.data.push({ date: '2022-01-01', value: 60, series: 'B' });
  const wide = compileChart(input, { width: 1024, height: 500 });
  expect(wide.endpointLabels?.interior?.map((label) => label.text)).toEqual(['A', 'B']);
  for (const entry of wide.endpointLabels!.entries) {
    expect(entry.labelLines).not.toContain(entry.seriesKey);
    expect(entry.date).toBeDefined();
    expect(entry.source?.x).toBe('2022-01-01');
  }
  const narrow = compileChart(input, { width: 390, height: 500 });
  expect(narrow.endpointLabels?.entries.map((entry) => entry.source)).toEqual(
    wide.endpointLabels?.entries.map((entry) => entry.source),
  );
});

it('falls back to endpoint series names when no full interior text box fits', () => {
  const input = spec();
  input.endpointLabels = { placement: 'interior' };
  input.data = input.data.map((row) => ({
    ...row,
    series: `${row.series} a very long series name that cannot fit`,
  }));
  const layout = compileChart(input, { width: 390, height: 250 });
  expect(layout.endpointLabels?.interior ?? []).toHaveLength(0);
  expect(
    layout.endpointLabels?.entries.every((entry) =>
      entry.labelLines.join(' ').includes('series name'),
    ),
  ).toBe(true);
});

it('qualifies unequal endpoint dates using the resolved UTC scale west of UTC', () => {
  const oldZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const layout = compileChart(spec(), { width: 900, height: 450 });
    expect(layout.endpointLabels?.entries.map((entry) => entry.date)).toEqual(['2022', '2021']);
    expect(layout.endpointLabels?.leading?.every((entry) => entry.date === undefined)).toBe(true);
  } finally {
    process.env.TZ = oldZone;
  }
});

it('falls back from overshooting interpolation instead of assuming sampled bounds contain a label', () => {
  const input = spec();
  input.mark = { type: 'area', interpolate: 'natural' };
  input.endpointLabels = { placement: 'interior' };
  const layout = compileChart(input, { width: 1024, height: 500 });
  expect(layout.endpointLabels?.interior ?? []).toHaveLength(0);
  expect(
    layout.marks
      .filter((mark) => mark.type === 'area')
      .every((mark) => mark.interpolate === 'natural'),
  ).toBe(true);
});

it.each([
  'zero',
  'center',
  'normalize',
] as const)('retains midpoint and own source value for negative %s bands', (stack) => {
  const input = spec(stack);
  input.data = input.data.map((row) => ({
    ...row,
    value: row.series === 'B' ? -Number(row.value) : row.value,
  }));
  const layout = compileChart(input, { width: 900, height: 450 });
  const band = layout.marks.find(
    (mark): mark is AreaMark => mark.type === 'area' && mark.seriesKey === 'B',
  )!;
  const point = band.dataPoints!.find((point) => point.datum.date === '2021-01-01')!;
  const endpoint = layout.endpointLabels!.entries.find((entry) => entry.seriesKey === 'B')!;
  expect(endpoint.dataY).toBe((point.y + point.yBottom!) / 2);
  expect(endpoint.source?.datum.value).toBe(-50);
});
