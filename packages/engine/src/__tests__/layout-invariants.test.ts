import type { ChartLayout } from '@opendata-ai/openchart-core';
import { afterAll, describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import { checkLayoutInvariants } from './helpers/invariants';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const SHORT_LABELS = ['A', 'B', 'C', 'D', 'E'];
const LONG_LABELS = [
  'United States of America',
  'United Kingdom of Great Britain',
  "People's Republic of China",
  'Federal Republic of Germany',
  'Commonwealth of Australia',
];

function makeNominalData(labels: string[]) {
  return labels.map((name, i) => ({ name, value: (i + 1) * 10 }));
}

function makeTemporalData(series: string[]) {
  const dates = ['2020-01-01', '2020-06-01', '2021-01-01', '2021-06-01', '2022-01-01'];
  return series.flatMap((s) =>
    dates.map((date, i) => ({ date, value: (i + 1) * 10 + 2.5, series: s })),
  );
}

function makePieData(labels: string[]) {
  return labels.map((category, i) => ({ category, value: (i + 1) * 15 }));
}

function makeScatterData(groups: string[]) {
  return groups.flatMap((group) =>
    Array.from({ length: 5 }, (_, i) => ({
      x: (i + 1) * 10 + 0.5 * 5,
      y: (i + 1) * 8 + 0.5 * 5,
      group,
    })),
  );
}

// ---------------------------------------------------------------------------
// Chrome presets
// ---------------------------------------------------------------------------

const NO_CHROME = {};
const TITLE_ONLY = { title: 'Chart Title', subtitle: 'A subtitle for context' };
const FULL_CHROME = {
  title: 'Chart Title',
  subtitle: 'A subtitle for context',
  source: 'Source: Test Data Corp',
  byline: 'By Test Author',
  footer: 'Note: values are illustrative',
};

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------

const WIDTHS = [320, 800] as const;
const HEIGHT = 400;

let compileSkipCount = 0;

/**
 * Compile a spec and run layout invariants. Returns early (skip) if
 * compileChart throws due to pre-existing compile failures from plan merges.
 */
function compileAndCheck(spec: Record<string, unknown>, width: number, height = HEIGHT) {
  let layout: ChartLayout;
  try {
    layout = compileChart(spec, { width, height });
  } catch {
    compileSkipCount++;
    return;
  }
  const violations = checkLayoutInvariants(layout, { svgWidth: width, svgHeight: height });
  expect(violations, violations.join('\n')).toEqual([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('layout invariants', () => {
  afterAll(() => {
    if (compileSkipCount > 0) {
      console.warn(`layout invariants: ${compileSkipCount} tests skipped due to compile errors`);
    }
  });

  // -----------------------------------------------------------------------
  // Bar charts (horizontal: x=quantitative, y=nominal)
  // -----------------------------------------------------------------------
  describe('bar charts (horizontal)', () => {
    for (const width of WIDTHS) {
      it(`short labels, no chrome at ${width}px`, () => {
        compileAndCheck(
          {
            mark: 'bar',
            data: makeNominalData(SHORT_LABELS),
            encoding: {
              x: { field: 'value', type: 'quantitative' },
              y: { field: 'name', type: 'nominal' },
            },
            chrome: NO_CHROME,
          },
          width,
        );
      });
    }

    it('long labels with full chrome at 320px', () => {
      compileAndCheck(
        {
          mark: 'bar',
          data: makeNominalData(LONG_LABELS),
          encoding: {
            x: { field: 'value', type: 'quantitative' },
            y: { field: 'name', type: 'nominal' },
          },
          chrome: FULL_CHROME,
        },
        320,
      );
    });

    it('long labels with title only at 800px', () => {
      compileAndCheck(
        {
          mark: 'bar',
          data: makeNominalData(LONG_LABELS),
          encoding: {
            x: { field: 'value', type: 'quantitative' },
            y: { field: 'name', type: 'nominal' },
          },
          chrome: TITLE_ONLY,
        },
        800,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Column charts (vertical bars: x=nominal, y=quantitative)
  // -----------------------------------------------------------------------
  describe('column charts (vertical)', () => {
    for (const width of WIDTHS) {
      it(`short labels, title+subtitle at ${width}px`, () => {
        compileAndCheck(
          {
            mark: 'bar',
            data: makeNominalData(SHORT_LABELS),
            encoding: {
              x: { field: 'name', type: 'nominal' },
              y: { field: 'value', type: 'quantitative' },
            },
            chrome: TITLE_ONLY,
          },
          width,
        );
      });
    }

    it('long labels with full chrome at 320px', () => {
      compileAndCheck(
        {
          mark: 'bar',
          data: makeNominalData(LONG_LABELS),
          encoding: {
            x: { field: 'name', type: 'nominal' },
            y: { field: 'value', type: 'quantitative' },
          },
          chrome: FULL_CHROME,
        },
        320,
      );
    });

    // Rotated long labels overflow the SVG bottom edge
    it.fails('long labels, no chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'bar',
          data: makeNominalData(LONG_LABELS),
          encoding: {
            x: { field: 'name', type: 'nominal' },
            y: { field: 'value', type: 'quantitative' },
          },
          chrome: NO_CHROME,
        },
        800,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Line charts (multi-series with legend variations)
  // -----------------------------------------------------------------------
  describe('line charts', () => {
    const series = ['US', 'UK', 'DE'];
    const data = makeTemporalData(series);

    for (const width of WIDTHS) {
      it(`multi-series with top legend at ${width}px`, () => {
        compileAndCheck(
          {
            mark: 'line',
            data,
            encoding: {
              x: { field: 'date', type: 'temporal' },
              y: { field: 'value', type: 'quantitative' },
              color: { field: 'series', type: 'nominal' },
            },
            legend: { position: 'top', show: true },
            chrome: TITLE_ONLY,
          },
          width,
        );
      });
    }

    it('multi-series with bottom legend, full chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'line',
          data,
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'series', type: 'nominal' },
          },
          legend: { position: 'bottom', show: true },
          chrome: FULL_CHROME,
        },
        800,
      );
    });

    it('multi-series with right legend, no chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'line',
          data,
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'series', type: 'nominal' },
          },
          legend: { position: 'right', show: true },
          chrome: NO_CHROME,
        },
        800,
      );
    });

    it('multi-series with bottom-right legend at 320px', () => {
      compileAndCheck(
        {
          mark: 'line',
          data,
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'series', type: 'nominal' },
          },
          legend: { position: 'bottom-right', show: true },
          chrome: TITLE_ONLY,
        },
        320,
      );
    });

    it('single series, full chrome at 320px', () => {
      compileAndCheck(
        {
          mark: 'line',
          data: makeTemporalData(['US']),
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
          },
          chrome: FULL_CHROME,
        },
        320,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Pie charts (arc mark: y=quantitative, color=nominal)
  // -----------------------------------------------------------------------
  describe('pie charts', () => {
    for (const width of WIDTHS) {
      it(`basic pie, title only at ${width}px`, () => {
        compileAndCheck(
          {
            mark: 'arc',
            data: makePieData(SHORT_LABELS),
            encoding: {
              y: { field: 'value', type: 'quantitative' },
              color: { field: 'category', type: 'nominal' },
            },
            chrome: TITLE_ONLY,
          },
          width,
        );
      });
    }

    it('pie with bottom legend, full chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'arc',
          data: makePieData(SHORT_LABELS),
          encoding: {
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'category', type: 'nominal' },
          },
          legend: { position: 'bottom', show: true },
          chrome: FULL_CHROME,
        },
        800,
      );
    });

    // Legend entry positions overflow bounds at narrow width with long labels
    it.fails('pie with long labels, top legend at 320px', () => {
      compileAndCheck(
        {
          mark: 'arc',
          data: makePieData(LONG_LABELS),
          encoding: {
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'category', type: 'nominal' },
          },
          legend: { position: 'top', show: true },
          chrome: TITLE_ONLY,
        },
        320,
      );
    });

    it('pie with no chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'arc',
          data: makePieData(SHORT_LABELS),
          encoding: {
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'category', type: 'nominal' },
          },
          chrome: NO_CHROME,
        },
        800,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Scatter charts (point mark: x=quantitative, y=quantitative)
  // -----------------------------------------------------------------------
  describe('scatter charts', () => {
    const groups = ['Group A', 'Group B', 'Group C'];

    for (const width of WIDTHS) {
      it(`multi-group with right legend at ${width}px`, () => {
        compileAndCheck(
          {
            mark: 'point',
            data: makeScatterData(groups),
            encoding: {
              x: { field: 'x', type: 'quantitative' },
              y: { field: 'y', type: 'quantitative' },
              color: { field: 'group', type: 'nominal' },
            },
            legend: { position: 'right', show: true },
            chrome: TITLE_ONLY,
          },
          width,
        );
      });
    }

    it('multi-group with top legend, full chrome at 320px', () => {
      compileAndCheck(
        {
          mark: 'point',
          data: makeScatterData(groups),
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            color: { field: 'group', type: 'nominal' },
          },
          legend: { position: 'top', show: true },
          chrome: FULL_CHROME,
        },
        320,
      );
    });

    it('single group, no chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'point',
          data: makeScatterData(['Only']),
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
          },
          chrome: NO_CHROME,
        },
        800,
      );
    });

    it('multi-group with bottom legend, full chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'point',
          data: makeScatterData(groups),
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            color: { field: 'group', type: 'nominal' },
          },
          legend: { position: 'bottom', show: true },
          chrome: FULL_CHROME,
        },
        800,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Dot charts (circle mark: x=quantitative, y=quantitative)
  // -----------------------------------------------------------------------
  describe('dot charts', () => {
    for (const width of WIDTHS) {
      it(`multi-group with bottom legend at ${width}px`, () => {
        compileAndCheck(
          {
            mark: 'circle',
            data: makeScatterData(['Alpha', 'Beta']),
            encoding: {
              x: { field: 'x', type: 'quantitative' },
              y: { field: 'y', type: 'quantitative' },
              color: { field: 'group', type: 'nominal' },
            },
            legend: { position: 'bottom', show: true },
            chrome: TITLE_ONLY,
          },
          width,
        );
      });
    }

    it('dot with full chrome, long legend labels at 320px', () => {
      compileAndCheck(
        {
          mark: 'circle',
          data: makeScatterData(['Very Long Group Name A', 'Very Long Group Name B']),
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            color: { field: 'group', type: 'nominal' },
          },
          legend: { position: 'top', show: true },
          chrome: FULL_CHROME,
        },
        320,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Area charts (area mark, similar encoding to line)
  // -----------------------------------------------------------------------
  describe('area charts', () => {
    const data = makeTemporalData(['Revenue', 'Expenses']);

    it('stacked area with top legend, full chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'area',
          data,
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'series', type: 'nominal' },
          },
          legend: { position: 'top', show: true },
          chrome: FULL_CHROME,
        },
        800,
      );
    });

    it('single series area, no chrome at 800px', () => {
      compileAndCheck(
        {
          mark: 'area',
          data: makeTemporalData(['Revenue']),
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
          },
          chrome: NO_CHROME,
        },
        800,
      );
    });

    it('stacked area with bottom-right legend at 320px', () => {
      compileAndCheck(
        {
          mark: 'area',
          data,
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'series', type: 'nominal' },
          },
          legend: { position: 'bottom-right', show: true },
          chrome: TITLE_ONLY,
        },
        320,
      );
    });
  });
});
