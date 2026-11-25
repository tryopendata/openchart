/**
 * Bar charts with `encoding.time`: the mirrored pyramid and plain grouped and stacked bars,
 * driven through `compileChartPlayback` and compared with static compiles of single periods.
 *
 * Tests declared with `it.fails` pin behavior that needs changes in chart-playback.ts or the
 * frame drawer (charts/scatter/playback-frames.ts); each says which.
 * They flip to failures once the fix lands, so they get converted to `it` then.
 */
import type {
  ChartSpec,
  CompileOptions,
  DataRow,
  Mark,
  RectMark,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import {
  JAPAN_AGE_GROUPS,
  japanPopulation,
} from '../../../../../examples/src/data/japan-population';
import { compileChart } from '../../compile';
import { compileChartPlayback } from '../chart-playback';
import type { ChartPlayback, FrameMark } from '../chart-types';
import { PERIOD_LABEL_KEY } from '../overlays';
import { compileOptions } from './chart-fixtures';

const YEARS = [2000, 2001, 2002];
const AGES = ['0-9', '10-19', '20+'];

/** Population by `sex|age` per year; `20+` has no rows in 2000, like a late-starting group. */
const PYRAMID: Record<string, Array<number | null>> = {
  'Male|0-9': [50, 40, 30],
  'Female|0-9': [48, 38, 28],
  'Male|10-19': [30, 45, 35],
  'Female|10-19': [31, 44, 36],
  'Male|20+': [null, 10, 60],
  'Female|20+': [null, 12, 70],
};

function pyramidRows(): DataRow[] {
  return Object.entries(PYRAMID).flatMap(([key, byYear]) => {
    const [sex, age] = key.split('|');
    return YEARS.flatMap((year, period) => {
      const pop = byYear[period];
      return pop === null ? [] : [{ sex, age, year, pop }];
    });
  });
}

function pyramidSpec(data: DataRow[] = pyramidRows(), ages: string[] = AGES): ChartSpec {
  return {
    mark: { type: 'bar', mirror: true },
    data,
    encoding: {
      y: { field: 'age', type: 'ordinal', sort: ages },
      x: { field: 'pop', type: 'quantitative', format: '~s' },
      color: { field: 'sex', type: 'nominal', sort: ['Male', 'Female'] },
      time: { field: 'year', type: 'temporal' },
    },
  } as ChartSpec;
}

/**
 * The spec without `time`, over one period's rows, with both axes pinned to the frozen
 * frame's domains (a static compile of 2000 alone would drop the empty `20+` row).
 */
function staticPeriodSpec(spec: ChartSpec, year: number, frozen: ChartPlayback): ChartSpec {
  const { time: _time, x, y, ...encoding } = spec.encoding as Record<string, object>;
  const { playback: _playback, ...rest } = spec;
  const domainOf = (channel: 'x' | 'y') => frozen.frame.scales[channel]?.scale.domain();
  return {
    ...rest,
    data: (spec.data as DataRow[]).filter((row) => row.year === year),
    encoding: {
      ...encoding,
      x: { ...x, scale: { domain: domainOf('x') } },
      y: { ...y, scale: { domain: domainOf('y') } },
    },
  } as unknown as ChartSpec;
}

function rectsByKey(marks: Array<Mark | FrameMark>): Map<string, RectMark> {
  const rects = new Map<string, RectMark>();
  for (const entry of marks) {
    const mark = 'mark' in entry ? entry.mark : entry;
    if (mark.type === 'rect' && mark.key) rects.set(mark.key, mark);
  }
  return rects;
}

function rectAt(playback: ChartPlayback, key: string, t: number): RectMark {
  const rect = rectsByKey(playback.marksAt(t)).get(key);
  if (!rect) throw new Error(`no rect for ${key} at t=${t}`);
  return rect;
}

function textMarks(marks: Mark[], prefix: string): TextMarkLayout[] {
  return marks.filter(
    (mark): mark is TextMarkLayout =>
      mark.type === 'textMark' && String(mark.key ?? '').startsWith(prefix),
  );
}

function xDomain(playback: ChartPlayback): number[] {
  return playback.frame.scales.x?.scale.domain().map(Number) ?? [];
}

describe('mirrored bars over time', () => {
  const playback = compileChartPlayback(pyramidSpec(), compileOptions);

  it('freezes one value scale over every period, so the axis never rescales', () => {
    const [low, high] = xDomain(playback);
    expect(low).toBe(0);
    expect(high).toBeGreaterThanOrEqual(70);
    const pixelsPerPerson = (key: string, period: number) =>
      rectAt(playback, key, period).width / Number(PYRAMID[key][period]);
    const reference = pixelsPerPerson('Male|0-9', 0);
    for (const [key, period] of [
      ['Female|0-9', 0],
      ['Male|10-19', 1],
      ['Female|20+', 2],
    ] as const) {
      expect(pixelsPerPerson(key, period)).toBeCloseTo(reference, 6);
    }
  });

  it('splits the plot into two halves of equal width around the gutter', () => {
    const area = playback.frame.chartArea;
    const [leftEdge, rightEdge] = ['Male|0-9', 'Female|0-9']
      .map((key) => Number(rectAt(playback, key, 0).baseline))
      .sort((a, b) => a - b);
    expect(rightEdge).toBeGreaterThan(leftEdge);
    const leftHalf = Math.abs(leftEdge - area.x);
    const rightHalf = Math.abs(area.x + area.width - rightEdge);
    expect(leftHalf).toBeCloseTo(rightHalf, 6);
  });

  it('draws each period at the lengths and rows of a static compile of its rows', () => {
    YEARS.forEach((year, period) => {
      const expected = rectsByKey(
        compileChart(staticPeriodSpec(pyramidSpec(), year, playback), compileOptions).marks,
      );
      for (const [key, rect] of expected) {
        const drawn = rectAt(playback, key, period);
        expect(drawn.width).toBeCloseTo(rect.width, 6);
        expect(drawn.y).toBeCloseTo(rect.y, 6);
        expect(drawn.height).toBeCloseTo(rect.height, 6);
      }
    });
  });

  // Frame rows arrive in sorted key order (Female first), so this holds only because the
  // mirror takes its sides from the color domain rather than row order.
  it('keeps each color on its own half, Male left as sorted, like the static chart', () => {
    YEARS.forEach((year, period) => {
      const expected = rectsByKey(
        compileChart(staticPeriodSpec(pyramidSpec(), year, playback), compileOptions).marks,
      );
      for (const [key, rect] of expected) {
        const drawn = rectAt(playback, key, period);
        expect(drawn.x).toBeCloseTo(rect.x, 6);
        expect(drawn.fill).toBe(rect.fill);
      }
    });
  });

  it('moves interpolated bars between their lengths at the periods either side', () => {
    for (const key of ['Male|0-9', 'Female|10-19', 'Female|20+']) {
      const before = rectAt(playback, key, 1).width;
      const after = rectAt(playback, key, 2).width;
      const between = rectAt(playback, key, 1.5).width;
      expect(between).toBeGreaterThan(Math.min(before, after));
      expect(between).toBeLessThan(Math.max(before, after));
    }
  });

  it('carries value labels at the outer end of their bar in every frame', () => {
    for (const t of [0, 0.5, 2]) {
      for (const rect of rectsByKey(playback.marksAt(t)).values()) {
        if (!rect.label) continue;
        const outerEnd = rect.label.style.textAnchor === 'end' ? rect.x : rect.x + rect.width;
        expect(Math.abs(rect.label.x - outerEnd)).toBeLessThan(10);
        expect(rect.label.y).toBeCloseTo(rect.y + rect.height / 2, 6);
      }
    }
  });

  it('fades a group in when it first has rows', () => {
    const presence = (key: string, t: number) =>
      playback.marksAt(t).find((entry) => entry.key === key)?.presence;
    expect(presence('Male|20+', 0)).toBe(0);
    expect(presence('Male|20+', 0.75)).toBeGreaterThan(0);
    expect(presence('Male|20+', 0.75)).toBeLessThan(1);
    expect(presence('Male|20+', 1)).toBe(1);
    expect(presence('Male|0-9', 0)).toBe(1);
  });

  // Needs compileChartPlayback to keep the renderer's marks that aren't matrix keys (the
  // `oc-mirror-category|*` gutter labels and `oc-mirror-half|*` half labels) in the base
  // layout; drawFrame keeps only matrix keys, so both label sets vanish.
  it.fails('keeps the gutter category labels and the half labels in the base layout', () => {
    const expected = compileChart(staticPeriodSpec(pyramidSpec(), 2002, playback), compileOptions);
    for (const prefix of ['oc-mirror-category|', 'oc-mirror-half|']) {
      const want = textMarks(expected.marks, prefix).map(({ key, text, x, y }) => ({
        key,
        text,
        x,
        y,
      }));
      const got = textMarks(playback.base.marks, prefix).map(({ key, text, x, y }) => ({
        key,
        text,
        x,
        y,
      }));
      expect(want.length).toBeGreaterThan(0);
      expect(got).toEqual(want);
    }
  });

  // Needs the frame drawer (charts/scatter/playback-frames.ts) to pass the compile's
  // measureText to the renderer: without it the mirror sizes its gutter from estimates while
  // the frozen axis ticks were placed with the real measurements.
  it.fails('puts the bars’ inner edges on the frozen axis zero ticks when text is measured', () => {
    const measured: CompileOptions = {
      ...compileOptions,
      measureText: (text, fontSize) => ({ width: text.length * fontSize * 0.9, height: fontSize }),
    };
    const measuredPlayback = compileChartPlayback(pyramidSpec(), measured);
    const zeroTicks = (measuredPlayback.frame.layout.axes.x?.ticks ?? [])
      .filter(({ value }) => Number(value) === 0)
      .map(({ position }) => position);
    const edges = [
      rectAt(measuredPlayback, 'Male|0-9', 1).baseline,
      rectAt(measuredPlayback, 'Female|0-9', 1).baseline,
    ].sort((a, b) => Number(a) - Number(b));
    expect(zeroTicks).toHaveLength(2);
    expect(edges[0]).toBeCloseTo(zeroTicks[0], 6);
    expect(edges[1]).toBeCloseTo(zeroTicks[1], 6);
  });

  it('puts the period label in the plot’s upper right, below the half labels', () => {
    const area = playback.frame.chartArea;
    const label = playback.overlaysAt(1).find(({ key }) => key === PERIOD_LABEL_KEY);
    if (!label || label.mark.type !== 'textMark') throw new Error('no period label');
    const { mark } = label;
    expect(mark.text).toBe('2001');
    expect(mark.textAnchor).toBe('end');
    expect(mark.dominantBaseline).toBe('hanging');
    expect(mark.x).toBeGreaterThan(area.x + area.width / 2);
    expect(mark.x).toBeLessThanOrEqual(area.x + area.width);
    // Half labels sit on a baseline above the plot's top edge; a hanging label starting
    // inside the plot can't reach them.
    expect(mark.y).toBeGreaterThan(area.y);
    expect(mark.y + mark.fontSize).toBeLessThan(area.y + area.height / 2);
  });
});

describe('the Japan pyramid, 1950 to 2100', () => {
  const playback = compileChartPlayback(
    pyramidSpec(japanPopulation.data, JAPAN_AGE_GROUPS),
    compileOptions,
  );
  const rows = japanPopulation.data;

  it('plays every five-year period with all 42 bars drawn throughout', () => {
    expect(playback.periodLabels[0]).toBe('1950');
    expect(playback.periodLabels.at(-1)).toBe('2100');
    expect(playback.periods).toHaveLength(31);
    for (const t of [0, 15, 30]) expect(playback.marksAt(t)).toHaveLength(42);
  });

  it('sizes the axis for the largest group in any year', () => {
    const largest = Math.max(...rows.map((row) => row.pop));
    const [, high] = xDomain(playback);
    expect(high).toBeGreaterThanOrEqual(largest);
    const pixelsPer = (sex: string, age: string, period: number) => {
      const row = rows.find(
        (candidate) =>
          candidate.sex === sex &&
          candidate.age === age &&
          candidate.year === Number(playback.periods[period].value),
      );
      return rectAt(playback, `${sex}|${age}`, period).width / Number(row?.pop);
    };
    expect(pixelsPer('Male', '0-4', 30)).toBeCloseTo(pixelsPer('Male', '0-4', 0), 6);
    expect(pixelsPer('Female', '70-74', 15)).toBeCloseTo(pixelsPer('Male', '0-4', 0), 6);
  });

  it('stacks the oldest group on top and the youngest at the bottom', () => {
    expect(rectAt(playback, 'Male|100+', 15).y).toBeLessThan(rectAt(playback, 'Male|0-4', 15).y);
  });
});

describe('grouped and stacked bars over time', () => {
  /** Sales by `team|quarter` per year. */
  const SALES: Record<string, number[]> = {
    'A|Q1': [10, 20],
    'B|Q1': [30, 5],
    'A|Q2': [15, 15],
    'B|Q2': [5, 40],
  };
  const rows = Object.entries(SALES).flatMap(([key, byYear]) => {
    const [team, quarter] = key.split('|');
    return byYear.map((sales, period) => ({ team, quarter, year: 2000 + period, sales }));
  });

  function columnSpec(stack: boolean): ChartSpec {
    return {
      mark: 'bar',
      data: rows,
      encoding: {
        x: { field: 'quarter', type: 'nominal' },
        y: { field: 'sales', type: 'quantitative', stack },
        color: { field: 'team', type: 'nominal' },
        time: { field: 'year', type: 'temporal' },
      },
    } as ChartSpec;
  }

  it('draws grouped columns at their own period values on one frozen scale', () => {
    const playback = compileChartPlayback(columnSpec(false), compileOptions);
    const y = playback.frame.scales.y?.scale as (value: number) => number;
    for (const t of [0, 1]) {
      for (const [key, byYear] of Object.entries(SALES)) {
        expect(rectAt(playback, key, t).height).toBeCloseTo(y(0) - y(byYear[t]), 6);
      }
    }
  });

  it('restacks every frame, so each segment sits on the frame’s own stack', () => {
    const playback = compileChartPlayback(columnSpec(true), compileOptions);
    for (const t of [0, 0.25, 0.5, 1]) {
      for (const quarter of ['Q1', 'Q2']) {
        const bottom = rectAt(playback, `A|${quarter}`, t);
        const top = rectAt(playback, `B|${quarter}`, t);
        expect(top.y + top.height).toBeCloseTo(bottom.y, 6);
      }
    }
    const y = playback.frame.scales.y?.scale as (value: number) => number;
    const q2Top = rectAt(playback, 'B|Q2', 0.5);
    expect(q2Top.y).toBeCloseTo(y(15 + 22.5), 6);
  });

  // All periods stacked together would give Q1 10+20+30+5 = 65; the tallest single-period
  // stack is Q2 in 2001, 15+40 = 55.
  it('sizes a stacked axis for the tallest stack in any one period', () => {
    const playback = compileChartPlayback(columnSpec(true), compileOptions);
    const [, high] = playback.frame.scales.y?.scale.domain().map(Number) ?? [];
    expect(high).toBeGreaterThanOrEqual(55);
    expect(high).toBeLessThan(65);
  });
});
