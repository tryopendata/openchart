import type { DataRow, Mark, PointMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { getChartRenderer } from '../../charts/registry';
import '../../charts/builtin';
import { compileChartPlayback } from '../chart-playback';
import type { ChartPlayback, FrameMark } from '../chart-types';
import { bubbleRows, bubbleSpec, compileOptions, syntheticRows, YEARS } from './chart-fixtures';

/**
 * Generous factor for shared CI runners, which run several vitest workers on small machines:
 * the 2ms budget holds on a laptop; CI gets 5x before this fails.
 */
const CI_FACTOR = 5;

function compile(rows: DataRow[] = bubbleRows(), overrides = {}): ChartPlayback {
  return compileChartPlayback(bubbleSpec(rows, overrides), compileOptions);
}

function point(frame: FrameMark[], key: string): PointMark {
  const found = frame.find((entry) => entry.key === key);
  if (!found || found.mark.type !== 'point') throw new Error(`no point for ${key}`);
  return found.mark;
}

function presence(playback: ChartPlayback, key: string, t: number): number {
  const found = playback.marksAt(t).find((entry) => entry.key === key);
  if (!found) throw new Error(`no frame mark for ${key}`);
  return found.presence;
}

function without(rows: DataRow[], country: string, years: number[]): DataRow[] {
  return rows.filter((row) => !(row.country === country && years.includes(Number(row.year))));
}

describe('spike: the frozen frame', () => {
  it('leaves the non-mark layout untouched and identical across frames', () => {
    const playback = compile();
    const layout = playback.frame.layout;
    const before = JSON.stringify(layout);
    for (const t of [0, 0.5, 1, 2]) playback.marksAt(t);
    expect(playback.frame.layout).toBe(layout);
    expect(JSON.stringify(playback.frame.layout)).toBe(before);
    expect(layout.marks).toEqual([]);
  });

  it('draws each period as the renderer does for that period’s rows on the frozen scales', () => {
    const playback = compile();
    const { frame } = playback;
    const renderer = getChartRenderer('point');
    if (!renderer) throw new Error('point renderer missing');
    YEARS.forEach((year, period) => {
      const rows = bubbleRows().filter((row) => row.year === year);
      const expected = renderer(
        { ...frame.spec, data: rows },
        frame.scales,
        frame.chartArea,
        frame.strategy,
        frame.theme,
        compileOptions.width,
        frame.labelPlan,
      ).filter((mark): mark is PointMark => mark.type === 'point');
      const actual = playback.marksAt(period);
      for (const mark of expected) {
        const drawn = point(actual, String(mark.key));
        expect(drawn.cx).toBeCloseTo(mark.cx, 6);
        expect(drawn.cy).toBeCloseTo(mark.cy, 6);
        expect(drawn.r).toBeCloseTo(mark.r, 6);
      }
    });
  });

  it('draws 200 keys in under 2ms per frame (median of 50)', () => {
    const playback = compileChartPlayback(bubbleSpec(syntheticRows(200, 10)), compileOptions);
    playback.marksAt(4.5);
    const runs: number[] = [];
    for (let run = 0; run < 50; run++) {
      const t = (run % 9) + 0.37;
      const start = performance.now();
      playback.marksAt(t);
      runs.push(performance.now() - start);
    }
    runs.sort((a, b) => a - b);
    expect(runs[25]).toBeLessThan(2 * CI_FACTOR);
  });
});

describe('frames', () => {
  it('returns one entry per base key, in base order, at every t', () => {
    const playback = compile();
    expect(playback.keys).toEqual(expect.arrayContaining(['Avalon', 'Borea', 'Cydonia', 'Dorne']));
    expect(playback.keys).toHaveLength(4);
    for (const t of [0, 0.3, 1, 1.9, 2]) {
      expect(playback.marksAt(t).map((entry) => entry.key)).toEqual(playback.keys);
    }
    expect(playback.base.marks.filter((mark) => mark.type === 'point')).toHaveLength(4);
  });

  it('clamps t to the periods', () => {
    const playback = compile();
    expect(point(playback.marksAt(-3), 'Avalon').cx).toBe(point(playback.marksAt(0), 'Avalon').cx);
    expect(point(playback.marksAt(99), 'Avalon').cx).toBe(point(playback.marksAt(2), 'Avalon').cx);
  });

  it('keeps every region’s color when a region is absent in some periods', () => {
    const rows = [
      ...bubbleRows(),
      { country: 'Erewhon', region: 'Island', year: 2002, gdp: 700, life: 58, pop: 500_000 },
    ];
    const playback = compile(rows);
    for (const key of ['Avalon', 'Cydonia']) {
      expect(point(playback.marksAt(0), key).fill).toEqual(point(playback.marksAt(2), key).fill);
    }
    expect(point(playback.marksAt(2), 'Erewhon').fill).not.toEqual(
      point(playback.marksAt(2), 'Avalon').fill,
    );
  });

  it('keeps one point opacity when the key count crosses 200 between periods', () => {
    // 150 keys in 1900, 250 keys in 1901.
    const rows = syntheticRows(250, 2).filter(
      (row) => row.year === 1901 || Number(String(row.country).slice(1)) < 150,
    );
    const playback = compile(rows);
    const opacities = new Set(
      [0, 0.5, 1].flatMap((t) =>
        playback.marksAt(t).map((entry) => (entry.mark as PointMark).fillOpacity),
      ),
    );
    expect([...opacities]).toEqual([playback.frame.pointOpacity]);
  });

  it('draws no trendline with time', () => {
    const playback = compile();
    const isTrend = (mark: Mark) => mark.type !== 'point' && mark.type !== 'textMark';
    expect(playback.base.marks.some(isTrend)).toBe(false);
    expect(playback.marksAt(1).some((entry) => isTrend(entry.mark))).toBe(false);
  });
});

describe('gaps', () => {
  it('interpolates interior gaps without fading, geometrically on a log axis', () => {
    const playback = compile(without(bubbleRows(), 'Avalon', [2001]));
    expect(presence(playback, 'Avalon', 1)).toBe(1);
    expect(presence(playback, 'Avalon', 0.5)).toBe(1);
    const x = playback.frame.scales.x?.scale as (value: number) => number;
    expect(point(playback.marksAt(1), 'Avalon').cx).toBeCloseTo(x(Math.sqrt(120 * 1500)), 6);
  });

  it('fades a dropped period out and back in', () => {
    const playback = compile(without(bubbleRows(), 'Avalon', [2001]), {
      playback: { gaps: 'drop' },
    });
    const at = (t: number) => presence(playback, 'Avalon', t);
    expect([at(0), at(0.25), at(0.5), at(1), at(1.5), at(1.75), at(2)]).toEqual([
      1, 0.5, 0, 0, 0, 0.5, 1,
    ]);
  });

  it('warns with a count when values <= 0 on a log x axis become absent', () => {
    const rows = bubbleRows().map((row) =>
      row.country === 'Dorne' && row.year !== 2000
        ? { ...row, gdp: row.year === 2001 ? 0 : -5 }
        : row,
    );
    const warnings: string[] = [];
    const playback = compileChartPlayback(bubbleSpec(rows), {
      ...compileOptions,
      onWarn: (message) => warnings.push(message),
    });
    const warning = playback.warnings.find((message) => message.includes('gdp'));
    expect(warning).toMatch(/\b2\b/);
    expect(warnings).toContain(warning);
  });
});

describe('entering and leaving', () => {
  // Erewhon appears in 2001; Dorne leaves after 2001.
  const rows = [
    ...without(bubbleRows(), 'Dorne', [2002]),
    { country: 'Erewhon', region: 'South', year: 2001, gdp: 700, life: 58, pop: 500_000 },
    { country: 'Erewhon', region: 'South', year: 2002, gdp: 800, life: 59, pop: 600_000 },
  ];

  it('fades a leaving key out over the first half of the interval, holding its last values', () => {
    const playback = compile(rows);
    expect([1, 1.25, 1.5, 2].map((t) => presence(playback, 'Dorne', t))).toEqual([1, 0.5, 0, 0]);
    expect(point(playback.marksAt(1.25), 'Dorne').cx).toBe(point(playback.marksAt(1), 'Dorne').cx);
  });

  it('fades an entering key in over the second half, holding its first values', () => {
    const playback = compile(rows);
    expect([0, 0.5, 0.75, 1].map((t) => presence(playback, 'Erewhon', t))).toEqual([0, 0, 0.5, 1]);
    expect(point(playback.marksAt(0.75), 'Erewhon').cx).toBe(
      point(playback.marksAt(1), 'Erewhon').cx,
    );
  });

  it('computes presence as a pure function of t', () => {
    const playback = compile(rows);
    const fresh = compile(rows);
    playback.marksAt(2);
    playback.marksAt(0);
    expect(playback.marksAt(1.25)).toEqual(fresh.marksAt(1.25));
  });
});

describe('text and labels', () => {
  it('formats observed values with the frozen formatter at every period', () => {
    const playback = compile();
    const formatPop = playback.frame.formatters.pop;
    for (const [period, year] of YEARS.entries()) {
      for (const row of bubbleRows().filter((r) => r.year === year)) {
        const observed = playback.observedAt(String(row.country), period);
        expect(observed?.values.pop).toBe(formatPop(Number(row.pop)));
      }
    }
  });

  it('labels the playback.labels keys at every frame and no other points', () => {
    const playback = compile(bubbleRows(), { playback: { labels: ['Cydonia'] } });
    for (const t of [0, 0.5, 2]) {
      const overlays = playback.overlaysAt(t);
      expect(overlays.map((entry) => entry.key)).toEqual([
        'oc-playback-period',
        'oc-playback-label|Cydonia',
      ]);
      const label = overlays[1].mark;
      expect(label.type === 'textMark' && label.text).toBe('Cydonia');
    }
  });

  it('reports the nearest period’s observed values, flagging gap-filled ones', () => {
    const playback = compile(without(bubbleRows(), 'Avalon', [2001]));
    expect(playback.observedAt('Avalon', 0.4)).toMatchObject({
      periodLabel: '2000',
      filled: false,
    });
    expect(playback.observedAt('Avalon', 0.6)).toMatchObject({ periodLabel: '2001', filled: true });
    expect(playback.observedAt('Nowhere', 1)).toBeNull();
  });

  it('describes a frame with its period', () => {
    const playback = compile();
    expect(playback.describe(2)).toContain('2002');
  });

  it('describes the period the playhead has reached, like the period label', () => {
    expect(compile().describe(1.6)).toBe('2001: 4 of 4 points shown.');
  });

  it('labels periods and resolves timing', () => {
    const playback = compile(bubbleRows(), { playback: { step: 500, loop: true } });
    expect(playback.periodLabels).toEqual(['2000', '2001', '2002']);
    expect(playback.periods.map((period) => period.value)).toEqual(YEARS);
    expect(playback.timing).toMatchObject({ durationMs: 1000, loop: true, holdEndMs: 1500 });
  });

  it('draws trails for the named keys only', () => {
    const playback = compile(bubbleRows(), { playback: { trails: ['Borea'] } });
    expect(playback.trailsAt(1.5).map((trail) => trail.key)).toEqual(['Borea']);
    expect(compile().trailsAt(1.5)).toEqual([]);
  });
});

describe('warnings', () => {
  function warningsFor(rows: DataRow[], overrides = {}): string[] {
    return compileChartPlayback(bubbleSpec(rows, overrides), compileOptions).warnings;
  }

  it('warns and plays nothing with fewer than two periods', () => {
    const rows = bubbleRows().filter((row) => row.year === 2000);
    const playback = compileChartPlayback(bubbleSpec(rows), compileOptions);
    expect(playback.periods).toHaveLength(1);
    expect(playback.warnings.some((message) => /period/i.test(message))).toBe(true);
    expect(playback.marksAt(0)).toHaveLength(4);
  });

  it('warns above 1,000 marks per period', () => {
    const rows = syntheticRows(1001, 2);
    expect(warningsFor(rows).some((message) => message.includes('1001'))).toBe(true);
    expect(warningsFor(syntheticRows(100, 2)).some((message) => /1,?000/.test(message))).toBe(
      false,
    );
  });

  it('warns about irregular temporal spacing, naming the range', () => {
    const rows = [1960, 1970, 1980, 1985].map((year, index) => ({
      country: 'Avalon',
      region: 'North',
      year,
      gdp: 100 * (index + 1),
      life: 50 + index,
      pop: 1000,
    }));
    const warning = warningsFor(rows).find((message) => /spaced evenly/.test(message));
    expect(warning).toContain('5 to 10 years');
    expect(warningsFor(bubbleRows()).some((message) => /spaced evenly/.test(message))).toBe(false);
  });

  it('warns below 50ms of playback per period', () => {
    expect(
      warningsFor(bubbleRows(), { playback: { step: 40 } }).some((message) =>
        /duration|timeUnit/.test(message),
      ),
    ).toBe(true);
  });

  it('warns when the matrix passes 2,000,000 cells, naming the counts', () => {
    // 1,001 keys x 700 periods x 3 channels; each key present in two adjacent periods only.
    const rows: DataRow[] = [];
    for (let key = 0; key < 1001; key++) {
      for (const offset of [0, 1]) {
        rows.push({
          country: `K${key}`,
          region: 'North',
          year: 1300 + ((key + offset) % 700),
          gdp: 100 + key,
          life: 50,
          pop: 1000,
        });
      }
    }
    const warning = warningsFor(rows).find((message) => /cells/.test(message));
    expect(warning).toContain('1001');
    expect(warning).toContain('700');
  });
});
