/**
 * Small bubble-chart fixtures for the chart playback tests: a few countries over three
 * years on a log GDP axis, plus a synthetic generator for size and performance cases.
 */
import type { ChartSpec, CompileOptions, DataRow } from '@opendata-ai/openchart-core';
import { buildPlaybackMatrix, type PlaybackGaps, type PlaybackMatrix } from '../matrix';

export const YEARS = [2000, 2001, 2002];

/** Four countries, every year present, values distinct per year. */
export function bubbleRows(): DataRow[] {
  const countries = [
    { country: 'Avalon', region: 'North', gdp: [120, 400, 1500], life: [50, 55, 60] },
    { country: 'Borea', region: 'North', gdp: [900, 1200, 2000], life: [62, 63, 66] },
    { country: 'Cydonia', region: 'South', gdp: [3000, 4500, 9000], life: [70, 71, 74] },
    { country: 'Dorne', region: 'South', gdp: [200, 260, 300], life: [40, 44, 47] },
  ];
  return countries.flatMap(({ country, region, gdp, life }, index) =>
    YEARS.map((year, period) => ({
      country,
      region,
      year,
      gdp: gdp[period],
      life: life[period],
      pop: (index + 1) * 1_000_000 * (period + 1),
    })),
  );
}

/** A Gapminder-style point chart over `rows` with time on `year` and key on `country`. */
export function bubbleSpec(
  rows: DataRow[] = bubbleRows(),
  overrides: Partial<ChartSpec> = {},
): ChartSpec {
  const spec: ChartSpec = {
    mark: 'point',
    data: rows,
    encoding: {
      x: { field: 'gdp', type: 'quantitative', scale: { type: 'log' } },
      y: { field: 'life', type: 'quantitative' },
      size: { field: 'pop', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
      key: { field: 'country', type: 'nominal' },
      time: { field: 'year', type: 'temporal' },
    },
  };
  return { ...spec, ...overrides } as ChartSpec;
}

/** The same chart without `time` (and with the trendline off), for static comparisons. */
export function staticSpec(spec: ChartSpec, rows: DataRow[] = spec.data as DataRow[]): ChartSpec {
  const { time: _time, ...encoding } = spec.encoding as Record<string, unknown>;
  const { playback: _playback, ...rest } = spec;
  return {
    ...rest,
    mark: { type: 'point', trendline: false },
    data: rows,
    encoding,
  } as unknown as ChartSpec;
}

/** The matrix layout freeze reads: channels named after the encoding channels they feed. */
export function bubbleMatrix(
  rows: DataRow[] = bubbleRows(),
  gaps: PlaybackGaps = 'interpolate',
): PlaybackMatrix {
  return buildPlaybackMatrix(
    rows,
    {
      identity: 'country',
      time: { field: 'year', type: 'temporal' },
      channels: [
        { name: 'x', field: 'gdp', log: true },
        { name: 'y', field: 'life' },
        { name: 'size', field: 'pop' },
      ],
      staticFields: ['region'],
    },
    gaps,
    () => {},
  );
}

/** `keyCount` keys over `periods` consecutive years starting at 1900, all present. */
export function syntheticRows(keyCount: number, periods: number): DataRow[] {
  const rows: DataRow[] = [];
  for (let key = 0; key < keyCount; key++) {
    for (let period = 0; period < periods; period++) {
      rows.push({
        country: `K${String(key).padStart(4, '0')}`,
        region: `R${key % 6}`,
        year: 1900 + period,
        gdp: 100 + ((key * 37 + period * 11) % 900),
        life: 30 + ((key * 13 + period * 7) % 50),
        pop: 1000 + key * 10 + period,
      });
    }
  }
  return rows;
}

export const compileOptions: CompileOptions = { width: 640, height: 420, onWarn: () => {} };
