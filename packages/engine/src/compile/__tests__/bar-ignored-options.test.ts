/**
 * Options playback bars ignore (RFC 2.3): the crosshair on mirrored bars and time specs,
 * and `encoding.key` on any bar. Each resolves to the ignored behavior and warns.
 */
import type { ChartSpec, DataRow } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { compileChartPlayback } from '../../playback/chart-playback';

const OPTIONS = { width: 600, height: 400 };

const ROWS: DataRow[] = [2000, 2001].flatMap((year) =>
  ['Male', 'Female'].flatMap((sex) =>
    ['0-9', '10-19'].map((age) => ({ sex, age, year, pop: 10 + year - 2000 })),
  ),
);

const STATIC_ROWS = ROWS.filter((row) => row.year === 2000);

function barSpec(
  top: Record<string, unknown> = {},
  encoding: Record<string, unknown> = {},
  mark: Record<string, unknown> = {},
): ChartSpec {
  return {
    mark: { type: 'bar', ...mark },
    data: STATIC_ROWS,
    ...top,
    encoding: {
      y: { field: 'age', type: 'ordinal' },
      x: { field: 'pop', type: 'quantitative' },
      color: { field: 'sex', type: 'nominal' },
      ...encoding,
    },
  } as ChartSpec;
}

function compileWarnings(spec: ChartSpec) {
  const sent: string[] = [];
  const layout = compileChart(spec, { ...OPTIONS, onWarn: (message) => sent.push(message) });
  return { layout, sent };
}

const CROSSHAIR_WARNING = /crosshair/i;
const KEY_WARNING = /encoding\.key.*ignored/;
const TIME = { field: 'year', type: 'temporal' };

describe('crosshair on mirrored bars', () => {
  it('stays off and warns when the author asks for it', () => {
    const { layout, sent } = compileWarnings(barSpec({ crosshair: true }, {}, { mirror: true }));
    expect(layout.crosshair).toBe(false);
    expect(sent.filter((message) => CROSSHAIR_WARNING.test(message))).toHaveLength(1);
  });

  it('stays off without a warning when the author did not ask', () => {
    const { layout, sent } = compileWarnings(barSpec({}, {}, { mirror: true }));
    expect(layout.crosshair).toBe(false);
    expect(sent.some((message) => CROSSHAIR_WARNING.test(message))).toBe(false);
  });
});

describe('crosshair on time specs', () => {
  it('is off in the playback base layout and warns through onWarn and warnings', () => {
    const sent: string[] = [];
    const playback = compileChartPlayback(
      barSpec({ data: ROWS, crosshair: true }, { time: TIME }),
      {
        ...OPTIONS,
        onWarn: (message) => sent.push(message),
      },
    );
    expect(playback.frame.layout.crosshair).toBe(false);
    expect(playback.warnings.filter((message) => CROSSHAIR_WARNING.test(message))).toHaveLength(1);
    expect(sent.some((message) => CROSSHAIR_WARNING.test(message))).toBe(true);
  });

  it('does not warn when the crosshair was not set', () => {
    const playback = compileChartPlayback(barSpec({ data: ROWS }, { time: TIME }), OPTIONS);
    expect(playback.warnings.some((message) => CROSSHAIR_WARNING.test(message))).toBe(false);
  });
});

describe('a line chart keeps an explicit crosshair', () => {
  it('turns it on without a warning', () => {
    const { layout, sent } = compileWarnings({
      mark: 'line',
      data: STATIC_ROWS.filter((row) => row.sex === 'Male'),
      crosshair: true,
      encoding: {
        x: { field: 'age', type: 'ordinal' },
        y: { field: 'pop', type: 'quantitative' },
      },
    } as ChartSpec);
    expect(layout.crosshair).toBe(true);
    expect(sent.some((message) => CROSSHAIR_WARNING.test(message))).toBe(false);
  });
});

describe('encoding.key on a bar', () => {
  const key = { field: 'sex', type: 'nominal' };

  it('warns once that bars match by color and category on a static bar', () => {
    const { sent } = compileWarnings(barSpec({}, { key }));
    const matches = sent.filter((message) => KEY_WARNING.test(message));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatch(/color and category/);
  });

  it('warns on a bar with time', () => {
    const sent: string[] = [];
    compileChartPlayback(barSpec({ data: ROWS }, { key, time: TIME }), {
      ...OPTIONS,
      onWarn: (message) => sent.push(message),
    });
    expect(sent.filter((message) => KEY_WARNING.test(message))).toHaveLength(1);
  });

  it('stays quiet for a bar without a key and for a non-bar mark with one', () => {
    expect(compileWarnings(barSpec()).sent.some((m) => KEY_WARNING.test(m))).toBe(false);
    const { sent } = compileWarnings({
      mark: 'point',
      data: STATIC_ROWS,
      encoding: {
        x: { field: 'pop', type: 'quantitative' },
        y: { field: 'pop', type: 'quantitative' },
        key,
      },
    } as ChartSpec);
    expect(sent.some((message) => KEY_WARNING.test(message))).toBe(false);
  });
});
