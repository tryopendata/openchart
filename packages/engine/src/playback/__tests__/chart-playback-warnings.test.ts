import type { ChartSpec, DataRow, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { compileChartPlayback } from '../chart-playback';
import { warnFrozenValueSort } from '../chart-warnings';
import { bubbleRows, bubbleSpec, compileOptions } from './chart-fixtures';

const WCAG_WARNING = /controls disabled.*WCAG 2\.2\.2/;
const SPACING_WARNING = /spaced evenly/;

function compileCollecting(spec: ChartSpec): { warnings: string[]; sent: string[] } {
  const sent: string[] = [];
  const { warnings } = compileChartPlayback(spec, {
    ...compileOptions,
    onWarn: (message) => sent.push(message),
  });
  return { warnings, sent };
}

function compileWith(playback: object): { warnings: string[]; sent: string[] } {
  return compileCollecting(bubbleSpec(bubbleRows(), { playback }));
}

describe('controls: false with autoplay', () => {
  it('warns that viewers cannot pause, in the result and through onWarn', () => {
    const { warnings, sent } = compileWith({ controls: false });
    const warning = warnings.find((message) => WCAG_WARNING.test(message));
    expect(warning).toBeDefined();
    expect(sent).toContain(warning);
  });

  it('stays quiet when autoplay is off or the controls are shown', () => {
    for (const playback of [{ controls: false, autoplay: false }, { autoplay: true }]) {
      expect(compileWith(playback).warnings.some((message) => WCAG_WARNING.test(message))).toBe(
        false,
      );
    }
  });
});

describe('authored rows that leave nothing to draw', () => {
  const cases: Array<[string, ChartSpec]> = [
    [
      'a filter drops every row',
      {
        ...bubbleSpec(),
        transform: [{ filter: { field: 'gdp', gte: 1e12 } }],
      } as ChartSpec,
    ],
    ['x is null everywhere', bubbleSpec(bubbleRows().map((row) => ({ ...row, gdp: null })))],
    [
      'every x value is <= 0 on a log axis',
      bubbleSpec(bubbleRows().map((row, index) => ({ ...row, gdp: -index }))),
    ],
  ];

  it.each(cases)('renders the empty static chart with a warning when %s', (_name, spec) => {
    const warnings: string[] = [];
    const layout = compileChart(spec, {
      ...compileOptions,
      onWarn: (message) => warnings.push(message),
    });
    expect(layout.marks).toEqual([]);
    expect(warnings.some((message) => /at least two periods/.test(message))).toBe(true);
  });
});

describe('bars', () => {
  it('follows unkeyed bars by color and category, one rect per key at each period', () => {
    const values: Record<string, number[]> = {
      'Men|Under 20': [10, 30],
      'Men|20 and over': [40, 20],
      'Women|Under 20': [15, 25],
      'Women|20 and over': [35, 45],
    };
    const rows: DataRow[] = Object.entries(values).flatMap(([key, byYear]) => {
      const [sex, age] = key.split('|');
      return byYear.map((count, index) => ({ sex, age, year: 2000 + index, count }));
    });
    const spec = {
      mark: 'bar',
      data: rows,
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'age', type: 'nominal' },
        color: { field: 'sex', type: 'nominal' },
        time: { field: 'year', type: 'temporal' },
      },
    } as ChartSpec;
    const playback = compileChartPlayback(spec, compileOptions);
    const x = playback.frame.scales.x?.scale as (value: number) => number;
    for (const period of [0, 1]) {
      const frame = playback.marksAt(period);
      expect(frame.map(({ key }) => key).sort()).toEqual(Object.keys(values).sort());
      for (const { key, mark } of frame) {
        expect(mark.type).toBe('rect');
        expect((mark as RectMark).width).toBeCloseTo(x(values[key][period]) - x(0), 6);
      }
    }
  });
});

describe('carried numeric fields', () => {
  it("reports a tooltip number at the period's own value, frozen-formatted", () => {
    const rows = bubbleRows().map((row) => ({
      ...row,
      year: Number(row.year) - 40,
      population: 1_000_000 * (Number(row.year) - 1990) + String(row.country).length,
    }));
    const spec = bubbleSpec(rows);
    const encoding = {
      ...spec.encoding,
      tooltip: [{ field: 'population', type: 'quantitative' as const }],
    };
    const playback = compileChartPlayback({ ...spec, encoding } as ChartSpec, compileOptions);
    const avalon1960 = rows.find((row) => row.country === 'Avalon' && row.year === 1960);
    expect(playback.observedAt('Avalon', 0)?.values.population).toBe(
      playback.frame.formatters.population(Number(avalon1960?.population)),
    );
  });
});

describe('spec sugar warnings', () => {
  it('sends a sugar warning once', () => {
    const spec = { ...bubbleSpec(), $schema: 'https://vega.github.io/schema/vega-lite/v5.json' };
    const { sent } = compileCollecting(spec as ChartSpec);
    expect(sent.filter((message) => message.includes('$schema'))).toHaveLength(1);
  });
});

describe('irregular spacing', () => {
  function spacingWarnings(years: number[]): string[] {
    const rows = years.map((year, index) => ({
      country: 'Avalon',
      region: 'North',
      year,
      gdp: 100 * (index + 1),
      life: 50 + index,
      pop: 1000,
    }));
    return compileCollecting(bubbleSpec(rows)).warnings.filter((message) =>
      SPACING_WARNING.test(message),
    );
  }

  it('reads epoch-millisecond periods as dates, so monthly data is regular', () => {
    expect(spacingWarnings([0, 1, 2, 3].map((month) => Date.UTC(2020, month, 1)))).toEqual([]);
  });

  it('still names the range for uneven years', () => {
    expect(spacingWarnings([1960, 1970, 1980, 1985])).toEqual([
      'Periods are spaced evenly in playback, but the gaps between them range from 5 to 10 years.',
    ]);
  });
});

describe('hidden series', () => {
  it('keeps every key and the frozen scales, and marks the legend entry hidden', () => {
    const visible = compileChartPlayback(bubbleSpec(), compileOptions);
    const hidden = compileChartPlayback(
      bubbleSpec(bubbleRows(), { hiddenSeries: ['South'] }),
      compileOptions,
    );
    for (const channel of ['x', 'y', 'color'] as const) {
      expect(hidden.frame.scales[channel]?.scale.domain()).toEqual(
        visible.frame.scales[channel]?.scale.domain(),
      );
    }
    expect(hidden.keys).toEqual(visible.keys);
    expect(hidden.marksAt(1)).toHaveLength(visible.marksAt(1).length);
    const entries =
      'entries' in hidden.frame.layout.legend ? hidden.frame.layout.legend.entries : [];
    expect(entries.map(({ label, active }) => [label, active !== false])).toEqual([
      ['North', true],
      ['South', false],
    ]);
  });
});

describe('bars sorted by value', () => {
  const FROZEN_SORT_WARNING = /keep one category order.*type: 'race'/;
  const rows: DataRow[] = [2000, 2001].flatMap((year, period) =>
    ['North', 'South', 'East'].map((region, index) => ({
      region,
      year,
      sales: (index + 1) * 10 * (period === 0 ? 1 : 4 - 2 * index),
    })),
  );

  function barSpec(sort: unknown, orient: 'horizontal' | 'vertical' = 'horizontal'): ChartSpec {
    const category = { field: 'region', type: 'nominal', sort };
    const value = { field: 'sales', type: 'quantitative' };
    return {
      mark: 'bar',
      data: rows,
      encoding: {
        ...(orient === 'horizontal' ? { y: category, x: value } : { x: category, y: value }),
        time: { field: 'year', type: 'temporal' },
      },
    } as ChartSpec;
  }

  function sortWarnings(spec: ChartSpec): string[] {
    const sent: string[] = [];
    warnFrozenValueSort(spec, (message) => sent.push(message));
    return sent;
  }

  it.each<[string, ChartSpec]>([
    ["'-x' on horizontal bars", barSpec('-x')],
    ["'y' on vertical columns", barSpec('y', 'vertical')],
    ['a field sort', barSpec({ field: 'sales', order: 'descending' })],
  ])('warns that %s holds still and points at the race chart', (_name, spec) => {
    const [warning, ...rest] = sortWarnings(spec);
    expect(rest).toEqual([]);
    expect(warning).toMatch(FROZEN_SORT_WARNING);
  });

  it('stays quiet for category sorts and for points', () => {
    for (const sort of [undefined, 'ascending', 'descending', null, ['South', 'North']]) {
      expect(sortWarnings(barSpec(sort))).toEqual([]);
    }
    expect(sortWarnings({ ...barSpec('-x'), mark: 'point' } as ChartSpec)).toEqual([]);
  });

  // Fails until compileChartPlayback passes the authored spec into collectPlaybackWarnings
  // (`{ matrix, channels, timing, time: pivot.time, spec }`); sugar has already turned the
  // sort into a fixed domain in the spec the playback compiles.
  it.fails('reaches the result and onWarn when the bar chart compiles', () => {
    const { warnings, sent } = compileCollecting(barSpec('-x'));
    expect(warnings.filter((message) => FROZEN_SORT_WARNING.test(message))).toHaveLength(1);
    expect(sent.filter((message) => FROZEN_SORT_WARNING.test(message))).toHaveLength(1);
  });
});
