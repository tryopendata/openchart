/**
 * Calendar heatmap tests.
 *
 * Integration-first through compileChart: assert the compiled layout
 * (marks, labels, legend, tooltips, axes) rather than internal helpers.
 * Date math is all UTC, so expectations hold on any host timezone.
 */

import type { RectMark, TextMarkLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';
import { validateSpec } from '../../../compiler/index';
import { weekdayRow } from '../compute';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;

/** One row per day starting at `start` (ISO date), deterministic values. */
function dailyRows(start: string, count: number): Array<{ date: string; value: number }> {
  const rows: Array<{ date: string; value: number }> = [];
  const t0 = Date.parse(start);
  for (let i = 0; i < count; i++) {
    rows.push({
      date: new Date(t0 + i * DAY_MS).toISOString().slice(0, 10),
      value: (i % 30) - 10,
    });
  }
  return rows;
}

function calendarSpec(data: Array<Record<string, unknown>>, mark: unknown = 'calendar') {
  return {
    mark,
    data,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      color: { field: 'value', type: 'quantitative' },
    },
  };
}

function compile(spec: unknown, options: Partial<Parameters<typeof compileChart>[1]> = {}) {
  return compileChart(spec, { width: 700, height: 360, ...options });
}

function rectsOf(layout: ReturnType<typeof compileChart>): RectMark[] {
  return layout.marks.filter((m): m is RectMark => m.type === 'rect');
}

function textsOf(layout: ReturnType<typeof compileChart>): TextMarkLayout[] {
  return layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');
}

function dataCells(layout: ReturnType<typeof compileChart>): RectMark[] {
  return rectsOf(layout).filter((r) => !r.aria.decorative);
}

function emptyCells(layout: ReturnType<typeof compileChart>): RectMark[] {
  return rectsOf(layout).filter((r) => r.aria.decorative);
}

/** Distinct sorted x positions (week columns) of the day cells. */
function columnsOf(rects: RectMark[]): number[] {
  return Array.from(new Set(rects.map((r) => r.x))).sort((a, b) => a - b);
}

/** Distinct sorted y positions (weekday rows) of the day cells. */
function rowsOf(rects: RectMark[]): number[] {
  return Array.from(new Set(rects.map((r) => r.y))).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Grid shape
// ---------------------------------------------------------------------------

describe('calendar grid shape', () => {
  // 2023: Jan 1 falls on a Sunday, so under the default monday weekStart the
  // first column starts on Dec 26, 2022 (a non-January-1st column start).
  const layout = compile(calendarSpec(dailyRows('2023-01-01', 365)));
  const rects = rectsOf(layout);

  it('renders 53 week columns x 7 weekday rows for a 365-day year', () => {
    expect(rects).toHaveLength(365);
    expect(columnsOf(rects)).toHaveLength(53);
    expect(rowsOf(rects)).toHaveLength(7);
  });

  it('places month labels at the column containing the 1st of each month', () => {
    const texts = textsOf(layout);
    const cols = columnsOf(rects);
    const step = cols[1] - cols[0];
    const gridLeft = cols[0];

    // Feb 1, 2023 is a Wednesday in the 6th week column (index 5): five
    // Mondays (Jan 2/9/16/23/30) sit between the Dec 26 grid start and Feb 1.
    const feb = texts.find((t) => t.text === 'Feb');
    expect(feb).toBeDefined();
    expect(feb!.x).toBeCloseTo(gridLeft + 5 * step, 6);

    // Jan 1 is in the first column even though the column starts in 2022.
    const jan = texts.find((t) => t.text === 'Jan');
    expect(jan!.x).toBeCloseTo(gridLeft, 6);

    // All 12 months present at this width.
    const monthTexts = texts.filter((t) =>
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].includes(
        t.text,
      ),
    );
    expect(monthTexts).toHaveLength(12);
  });

  it('renders Mon/Wed/Fri weekday labels left of the grid', () => {
    const texts = textsOf(layout);
    const gridLeft = columnsOf(rects)[0];
    for (const label of ['Mon', 'Wed', 'Fri']) {
      const mark = texts.find((t) => t.text === label);
      expect(mark).toBeDefined();
      expect(mark!.textAnchor).toBe('end');
      expect(mark!.x).toBeLessThan(gridLeft);
    }
  });

  it('suppresses axes and gridlines', () => {
    expect(layout.axes.x).toBeUndefined();
    expect(layout.axes.y).toBeUndefined();
  });

  it('keys every cell by its ISO date', () => {
    expect(rects.find((r) => r.key === '2023-06-15')).toBeDefined();
    const keys = new Set(rects.map((r) => r.key));
    expect(keys.size).toBe(rects.length);
  });

  // Calendar labels hand-compute their y against the SVG default (alphabetic)
  // baseline — see the `+ labelFont * 0.35` centering in compute.ts. Setting a
  // dominantBaseline here would double-correct them and shift every label.
  it('leaves dominantBaseline unset so its hand-computed baselines still hold', () => {
    const texts = textsOf(layout);
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text.dominantBaseline).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Leap years and missing days
// ---------------------------------------------------------------------------

describe('calendar leap years and missing days', () => {
  // 60 days from Feb 1, 2024 cover Feb 29 in a leap year; the rest of the
  // year renders as empty cells.
  const spec = calendarSpec(dailyRows('2024-02-01', 60));
  const layout = compile(spec);

  it('renders Feb 29 in a leap year as a data cell', () => {
    expect(rectsOf(layout)).toHaveLength(366);
    const feb29 = rectsOf(layout).find((r) => r.key === '2024-02-29');
    expect(feb29).toBeDefined();
    expect(feb29!.aria.decorative).toBeUndefined();
    expect(feb29!.aria.label).toContain('Feb 29, 2024');
  });

  it('renders missing days as surface-tinted empty cells, distinct from the scale minimum', () => {
    const empty = emptyCells(layout);
    const data = dataCells(layout);
    expect(empty).toHaveLength(306);
    expect(data).toHaveLength(60);

    // Empty cells carry the theme's achromatic surface tint...
    for (const cell of empty.slice(0, 5)) {
      expect(cell.fill).toBe(layout.theme.colors.annotationFill);
    }

    // ...which differs from the chromatic fill of the lowest data value.
    const minValue = Math.min(...data.map((r) => Number(r.data.value)));
    const minCell = data.find((r) => Number(r.data.value) === minValue)!;
    expect(minCell.fill).not.toBe(empty[0].fill);
  });

  it('keeps the empty/minimum distinction in dark mode', () => {
    const dark = compile(spec, { darkMode: true });
    const empty = emptyCells(dark);
    const data = dataCells(dark);
    const minValue = Math.min(...data.map((r) => Number(r.data.value)));
    const minCell = data.find((r) => Number(r.data.value) === minValue)!;

    expect(empty[0].fill).toBe(dark.theme.colors.annotationFill);
    expect(empty[0].fill).not.toBe(minCell.fill);
    // Dark mode swaps in its own tint (not the light-mode one).
    expect(empty[0].fill).not.toBe(layout.theme.colors.annotationFill);
  });

  it('gives data cells a date-titled tooltip and empty cells none', () => {
    expect(layout.tooltipDescriptors.size).toBe(60);
    const firstDataIndex = layout.marks.findIndex((m) => m.type === 'rect' && !m.aria.decorative);
    const descriptor = layout.tooltipDescriptors.get(`rect-${firstDataIndex}`);
    expect(descriptor).toBeDefined();
    expect(descriptor!.title).toContain('2024');
    expect(descriptor!.fields[0].label).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// Multi-year stacking
// ---------------------------------------------------------------------------

describe('calendar multi-year stacking', () => {
  const layout = compile(calendarSpec(dailyRows('2023-01-01', 730)), { height: 500 });
  const rects = rectsOf(layout);

  it('renders one labeled band per year', () => {
    // 2023 (365) + 2024 leap (366)
    expect(rects).toHaveLength(731);
    const yearLabels = textsOf(layout)
      .filter((t) => /^\d{4}$/.test(t.text))
      .map((t) => t.text);
    expect(yearLabels).toEqual(['2023', '2024']);

    // Two vertically separated bands: 14 distinct row positions, and the
    // top of the 2024 band sits below the bottom of the 2023 band.
    const rows = rowsOf(rects);
    expect(rows).toHaveLength(14);
    const band2023Bottom = Math.max(
      ...rects.filter((r) => r.key!.startsWith('2023')).map((r) => r.y),
    );
    const band2024Top = Math.min(...rects.filter((r) => r.key!.startsWith('2024')).map((r) => r.y));
    expect(band2024Top).toBeGreaterThan(band2023Bottom);
  });

  it('shares one color scale and one legend across years', () => {
    // dailyRows cycles values every 30 days, so day 9 of each January
    // differs while equal values across years must share a fill.
    const sameValuePairs = rects.filter((r) => !r.aria.decorative && Number(r.data.value) === 5);
    const fills = new Set(sameValuePairs.map((r) => String(r.fill)));
    expect(sameValuePairs.length).toBeGreaterThan(2);
    expect(fills.size).toBe(1);

    // Continuous legend, on by default, exactly one.
    expect(layout.legend.type).toBe('continuous');
    expect(layout.legend.bounds.height).toBeGreaterThan(0);
  });

  it('hides the year label for single-year data', () => {
    const single = compile(calendarSpec(dailyRows('2023-01-01', 365)));
    const yearLabels = textsOf(single).filter((t) => /^\d{4}$/.test(t.text));
    expect(yearLabels).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// weekStart
// ---------------------------------------------------------------------------

describe('calendar weekStart', () => {
  it('computes weekday rows for known dates', () => {
    const wed = new Date(Date.UTC(2024, 1, 29)); // Feb 29, 2024: Thursday
    const sun = new Date(Date.UTC(2024, 1, 4)); // Feb 4, 2024: Sunday
    const mon = new Date(Date.UTC(2024, 0, 1)); // Jan 1, 2024: Monday

    expect(weekdayRow(mon, 'monday')).toBe(0);
    expect(weekdayRow(mon, 'sunday')).toBe(1);
    expect(weekdayRow(wed, 'monday')).toBe(3);
    expect(weekdayRow(wed, 'sunday')).toBe(4);
    expect(weekdayRow(sun, 'monday')).toBe(6);
    expect(weekdayRow(sun, 'sunday')).toBe(0);
  });

  it('holds the shift property: sunday rows = (monday rows + 1) mod 7', () => {
    // Property over every day of a month that spans a leap boundary.
    for (let d = 1; d <= 29; d++) {
      const day = new Date(Date.UTC(2024, 1, d));
      expect(weekdayRow(day, 'sunday')).toBe((weekdayRow(day, 'monday') + 1) % 7);
    }
  });

  it('shifts compiled rows when weekStart is sunday', () => {
    const data = dailyRows('2024-02-01', 60);
    const monday = compile(calendarSpec(data));
    const sunday = compile(calendarSpec(data, { type: 'calendar', weekStart: 'sunday' }));

    const rowIndex = (layout: ReturnType<typeof compileChart>, key: string) => {
      const rects = rectsOf(layout);
      return rowsOf(rects).indexOf(rects.find((r) => r.key === key)!.y);
    };

    // Feb 29, 2024 (Thursday): row 3 under monday start, row 4 under sunday.
    expect(rowIndex(monday, '2024-02-29')).toBe(3);
    expect(rowIndex(sunday, '2024-02-29')).toBe(4);
    // Feb 4, 2024 (Sunday): last row under monday start, first under sunday.
    expect(rowIndex(monday, '2024-02-04')).toBe(6);
    expect(rowIndex(sunday, '2024-02-04')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mark options and responsive floor
// ---------------------------------------------------------------------------

describe('calendar mark options and responsive floor', () => {
  it('applies cellRadius to day cells (default 2)', () => {
    const data = dailyRows('2024-02-01', 30);
    const defaulted = compile(calendarSpec(data));
    expect(rectsOf(defaulted)[0].cornerRadius).toBe(2);

    const rounded = compile(calendarSpec(data, { type: 'calendar', cellRadius: 3 }));
    expect(rectsOf(rounded)[0].cornerRadius).toBe(3);
  });

  it('floors cell size at 7px on narrow containers instead of shrinking further', () => {
    const layout = compile(calendarSpec(dailyRows('2023-01-01', 365)), {
      width: 320,
      height: 400,
    });
    for (const rect of rectsOf(layout)) {
      expect(rect.width).toBeGreaterThanOrEqual(7);
      expect(rect.height).toBeGreaterThanOrEqual(7);
    }
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('calendar validation', () => {
  const rows = dailyRows('2024-01-01', 10);

  it('rejects a declared non-temporal x with the allowed types', () => {
    const spec = {
      mark: 'calendar',
      data: [{ cat: 'a', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    };
    expect(() => compile(spec)).toThrow(/does not accept type "nominal".*temporal/s);
  });

  it('rejects an inferred non-temporal x with a fix suggestion', () => {
    const spec = {
      mark: 'calendar',
      data: [{ cat: 'apple', value: 1 }],
      encoding: { x: { field: 'cat' }, color: { field: 'value', type: 'quantitative' } },
    };
    expect(() => compile(spec)).toThrow(/requires temporal encoding\.x.*inferred as nominal/s);
  });

  it('rejects unparseable dates naming the offending row', () => {
    const spec = calendarSpec([...rows, { date: 'not-a-date', value: 3 }]);
    expect(() => compile(spec)).toThrow(/unparseable date at data\[10\].*"not-a-date"/s);
  });

  it('rejects sub-daily granularity with a timeUnit aggregation hint', () => {
    const spec = calendarSpec([
      { date: '2024-01-01T02:00:00Z', value: 1 },
      { date: '2024-01-01T14:00:00Z', value: 2 },
    ]);
    expect(() => compile(spec)).toThrow(/daily granularity.*same day/s);
    // The fix lives in the structured suggestion (compile joins messages only).
    const result = validateSpec(spec);
    const granularityError = result.errors.find((e) => /daily granularity/.test(e.message));
    expect(granularityError?.suggestion).toMatch(/timeUnit/);
  });

  it('rejects encoding.y', () => {
    const spec = {
      mark: 'calendar',
      data: rows,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'value', type: 'quantitative' },
      },
    };
    expect(() => compile(spec)).toThrow(/does not accept encoding\.y/);
  });

  it('rejects an invalid weekStart listing the valid options', () => {
    const spec = calendarSpec(rows, { type: 'calendar', weekStart: 'tuesday' });
    expect(() => compile(spec)).toThrow(/weekStart "tuesday"/);
    const result = validateSpec(spec);
    const weekStartError = result.errors.find((e) => /weekStart/.test(e.message));
    expect(weekStartError?.suggestion).toMatch(/monday.*sunday/s);
  });

  it('requires the color channel', () => {
    const spec = {
      mark: 'calendar',
      data: rows,
      encoding: { x: { field: 'date', type: 'temporal' } },
    };
    expect(() => compile(spec)).toThrow(/requires encoding\.color/);
  });

  it('skips per-row date checks when transforms will reshape the data', () => {
    const spec = {
      ...calendarSpec([
        { date: '2024-01-01T02:00:00Z', value: 1 },
        { date: '2024-01-01T14:00:00Z', value: 2 },
      ]),
      transform: [{ timeUnit: 'yearmonthdate' as const, field: 'date', as: 'day' }],
      encoding: {
        x: { field: 'day', type: 'temporal' as const },
        color: { field: 'value', type: 'quantitative' as const },
      },
    };
    // Sub-daily rows plus an aggregating transform must not trip the
    // granularity check at validation time.
    expect(() => compile(spec)).not.toThrow(/daily granularity/);
  });
});

describe('calendar color scale and legend', () => {
  /** Rows where every value is a distinct positive, plus explicit zeros. */
  function zeroAndRange(): Array<{ date: string; value: number }> {
    const rows = dailyRows('2024-01-01', 40).map((r, i) => ({ ...r, value: i % 11 }));
    rows[0].value = 0;
    return rows;
  }

  it('defaults the color scale to five quantize classes', () => {
    const layout = compile(calendarSpec(zeroAndRange()));
    const legend = layout.legend as { type?: string; mode?: string; bins?: unknown[] };
    expect(legend.type).toBe('continuous');
    expect(legend.mode).toBe('binned');
    expect(legend.bins).toHaveLength(5);
  });

  it('fills a recorded zero with the lightest ramp step, not the missing-day fill', () => {
    const layout = compile(calendarSpec(zeroAndRange()));
    const legend = layout.legend as { bins: Array<{ color: string }> };
    const lightest = legend.bins[0].color;
    const zeroCell = dataCells(layout).find((c) => c.data.value === 0)!;
    expect(zeroCell.fill).toBe(lightest);

    const missing = emptyCells(layout)[0];
    expect(missing.fill).not.toBe(zeroCell.fill);
  });

  it('renders the compact Less/More key instead of break values', () => {
    const layout = compile(calendarSpec(zeroAndRange()));
    const legend = layout.legend as { ticks: Array<{ label: string; anchor: string }> };
    expect(legend.ticks.map((t) => t.label)).toEqual(['Less', 'More']);
    expect(legend.ticks[0].anchor).toBe('end');
    expect(legend.ticks[1].anchor).toBe('start');
  });

  it('hangs the compact key off the right edge, on the swatch baseline', () => {
    const layout = compile(calendarSpec(zeroAndRange()));
    const legend = layout.legend as {
      bounds: { x: number; width: number };
      bar: { y: number; height: number };
      labelY: number;
    };
    const right = legend.bounds.x + legend.bounds.width;
    expect(right).toBeGreaterThan(layout.area.x + layout.area.width - 1);
    // Labels sit on the swatch row, not on a line beneath it.
    expect(legend.labelY).toBeLessThan(legend.bar.y + legend.bar.height);
  });

  it('stamps crispEdges on day cells', () => {
    const layout = compile(calendarSpec(zeroAndRange()));
    expect(rectsOf(layout)[0].shapeRendering).toBe('crispEdges');
  });
});
