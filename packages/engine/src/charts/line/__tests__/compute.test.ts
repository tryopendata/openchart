import type { LayoutStrategy, LineMark, PointMark, Rect } from '@opendata-ai/openchart-core';
import { adaptTheme, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeAreaMarks } from '../area';
import { computeLineMarks } from '../compute';
import { computeLineLabels } from '../labels';

const DARK_THEME = adaptTheme(resolveTheme());

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const chartArea: Rect = { x: 50, y: 20, width: 500, height: 300 };

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

const compactStrategy: LayoutStrategy = {
  labelMode: 'none',
  legendPosition: 'top',
  annotationPosition: 'tooltip-only',
  axisLabelDensity: 'minimal',
};

function makeSingleSeriesSpec(): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line', point: true },
    data: [
      { date: '2020-01-01', value: 10 },
      { date: '2021-01-01', value: 40 },
      { date: '2022-01-01', value: 30 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeMultiSeriesSpec(): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line', point: true },
    data: [
      { date: '2020-01-01', value: 10, country: 'US' },
      { date: '2021-01-01', value: 40, country: 'US' },
      { date: '2022-01-01', value: 30, country: 'US' },
      { date: '2020-01-01', value: 15, country: 'UK' },
      { date: '2021-01-01', value: 35, country: 'UK' },
      { date: '2022-01-01', value: 45, country: 'UK' },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'country', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeMissingDataSpec(): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line', point: true },
    data: [
      { date: '2020-01-01', value: 10 },
      { date: '2021-01-01', value: null },
      { date: '2022-01-01', value: 30 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

// ---------------------------------------------------------------------------
// Line mark computation tests
// ---------------------------------------------------------------------------

describe('computeLineMarks', () => {
  describe('single series', () => {
    it('produces one LineMark and PointMarks for each data point', () => {
      const spec = makeSingleSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
      const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');

      expect(lineMarks).toHaveLength(1);
      expect(pointMarks).toHaveLength(3);
    });

    it('line mark has correct number of points', () => {
      const spec = makeSingleSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      expect(lineMark.points).toHaveLength(3);
    });

    it('line mark points are within chart area bounds', () => {
      const spec = makeSingleSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      for (const point of lineMark.points) {
        expect(point.x).toBeGreaterThanOrEqual(chartArea.x);
        expect(point.x).toBeLessThanOrEqual(chartArea.x + chartArea.width);
        // Y axis is inverted (higher values = lower y)
        expect(point.y).toBeGreaterThanOrEqual(chartArea.y);
        expect(point.y).toBeLessThanOrEqual(chartArea.y + chartArea.height);
      }
    });

    it('single series has no seriesKey', () => {
      const spec = makeSingleSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      expect(lineMark.seriesKey).toBeUndefined();
    });

    it('visible point marks have filled opacity when point: true', () => {
      const spec = makeSingleSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
      for (const pm of pointMarks) {
        expect(pm.fillOpacity).toBe(1);
      }
    });
  });

  describe('multi-series', () => {
    it('produces separate LineMarks for each series', () => {
      const spec = makeMultiSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
      expect(lineMarks).toHaveLength(2);
    });

    it('each series has a distinct seriesKey', () => {
      const spec = makeMultiSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
      const keys = lineMarks.map((m) => m.seriesKey);
      expect(keys).toContain('US');
      expect(keys).toContain('UK');
    });

    it('each series has different stroke colors', () => {
      const spec = makeMultiSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
      expect(lineMarks[0].stroke).not.toBe(lineMarks[1].stroke);
    });

    it('produces point marks for all data points across all series', () => {
      const spec = makeMultiSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
      // 3 points per series * 2 series = 6
      expect(pointMarks).toHaveLength(6);
    });
  });

  describe('missing data', () => {
    it('breaks line at null values - fewer points in the line', () => {
      const spec = makeMissingDataSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      // null value is excluded, so only 2 valid points remain
      expect(lineMark.points).toHaveLength(2);
    });

    it('produces point marks only for valid data points', () => {
      const spec = makeMissingDataSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
      expect(pointMarks).toHaveLength(2);
    });
  });

  describe('x-axis sorting', () => {
    it('sorts unsorted temporal data so points increase left-to-right', () => {
      const spec: NormalizedChartSpec = {
        ...makeSingleSeriesSpec(),
        data: [
          { date: '2022-01-01', value: 30 },
          { date: '2020-01-01', value: 10 },
          { date: '2021-01-01', value: 40 },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      // Points should have monotonically increasing x pixel values
      for (let i = 1; i < lineMark.points.length; i++) {
        expect(lineMark.points[i].x).toBeGreaterThan(lineMark.points[i - 1].x);
      }
    });

    it('sorts reverse-ordered dates correctly', () => {
      const spec: NormalizedChartSpec = {
        ...makeSingleSeriesSpec(),
        data: [
          { date: '2025-01-01', value: 50 },
          { date: '2024-01-01', value: 40 },
          { date: '2023-01-01', value: 30 },
          { date: '2022-01-01', value: 20 },
          { date: '2021-01-01', value: 10 },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      expect(lineMark.points).toHaveLength(5);
      for (let i = 1; i < lineMark.points.length; i++) {
        expect(lineMark.points[i].x).toBeGreaterThan(lineMark.points[i - 1].x);
      }
    });

    it('sorts unsorted numeric x-axis data', () => {
      const spec: NormalizedChartSpec = {
        ...makeSingleSeriesSpec(),
        data: [
          { date: 2022, value: 30 },
          { date: 2020, value: 10 },
          { date: 2021, value: 40 },
        ],
        encoding: {
          x: { field: 'date', type: 'quantitative' },
          y: { field: 'value', type: 'quantitative' },
        },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      for (let i = 1; i < lineMark.points.length; i++) {
        expect(lineMark.points[i].x).toBeGreaterThan(lineMark.points[i - 1].x);
      }
    });

    it('sorts each series independently in multi-series', () => {
      const spec: NormalizedChartSpec = {
        ...makeMultiSeriesSpec(),
        data: [
          { date: '2022-01-01', value: 30, country: 'US' },
          { date: '2020-01-01', value: 10, country: 'US' },
          { date: '2021-01-01', value: 40, country: 'US' },
          { date: '2022-01-01', value: 45, country: 'UK' },
          { date: '2020-01-01', value: 15, country: 'UK' },
          { date: '2021-01-01', value: 35, country: 'UK' },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
      for (const lm of lineMarks) {
        for (let i = 1; i < lm.points.length; i++) {
          expect(lm.points[i].x).toBeGreaterThan(lm.points[i - 1].x);
        }
      }
    });

    it('attaches data rows in sorted order on marks', () => {
      const spec: NormalizedChartSpec = {
        ...makeSingleSeriesSpec(),
        data: [
          { date: '2022-01-01', value: 30 },
          { date: '2020-01-01', value: 10 },
          { date: '2021-01-01', value: 40 },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      // The data array on the mark should be chronologically ordered
      const dates = lineMark.data!.map((r) => r.date);
      expect(dates).toEqual(['2020-01-01', '2021-01-01', '2022-01-01']);
    });

    it('sorts data before handling null y-value line breaks', () => {
      // Unsorted data with a null in the middle chronologically.
      // After sorting: 2020 (10), 2021 (null), 2022 (30) -> line breaks at 2021
      const spec: NormalizedChartSpec = {
        ...makeSingleSeriesSpec(),
        data: [
          { date: '2022-01-01', value: 30 },
          { date: '2021-01-01', value: null },
          { date: '2020-01-01', value: 10 },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMark = marks.find((m): m is LineMark => m.type === 'line')!;
      // Null is excluded, so only 2 valid points
      expect(lineMark.points).toHaveLength(2);
      // The two valid points should still be left-to-right
      expect(lineMark.points[1].x).toBeGreaterThan(lineMark.points[0].x);
    });

    it('produces identical output for already-sorted data', () => {
      // Verify sorting doesn't break pre-sorted input (regression check)
      const sorted = makeSingleSeriesSpec(); // already chronological
      const shuffled: NormalizedChartSpec = {
        ...sorted,
        data: [
          { date: '2021-01-01', value: 40 },
          { date: '2020-01-01', value: 10 },
          { date: '2022-01-01', value: 30 },
        ],
      };

      const sortedScales = computeScales(sorted, chartArea, sorted.data);
      const sortedMarks = computeLineMarks(sorted, sortedScales, chartArea, fullStrategy);

      const shuffledScales = computeScales(shuffled, chartArea, shuffled.data);
      const shuffledMarks = computeLineMarks(shuffled, shuffledScales, chartArea, fullStrategy);

      const sortedLine = sortedMarks.find((m): m is LineMark => m.type === 'line')!;
      const shuffledLine = shuffledMarks.find((m): m is LineMark => m.type === 'line')!;

      // Both should produce the same pixel positions
      expect(sortedLine.points).toEqual(shuffledLine.points);
    });

    it('sorts within-year dates by month in multi-series', () => {
      const spec: NormalizedChartSpec = {
        ...makeMultiSeriesSpec(),
        data: [
          { date: '2020-12-01', value: 30, country: 'US' },
          { date: '2020-03-01', value: 10, country: 'US' },
          { date: '2020-07-01', value: 20, country: 'US' },
          { date: '2020-12-01', value: 45, country: 'UK' },
          { date: '2020-03-01', value: 15, country: 'UK' },
          { date: '2020-07-01', value: 25, country: 'UK' },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
      expect(lineMarks).toHaveLength(2);

      for (const lm of lineMarks) {
        // Data rows should be Mar -> Jul -> Dec
        const dates = lm.data!.map((r) => r.date);
        expect(dates).toEqual(['2020-03-01', '2020-07-01', '2020-12-01']);
      }
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no x encoding', () => {
      const spec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line', point: true },
        data: [{ value: 10 }],
        encoding: {
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });

    it('returns empty array for empty data', () => {
      const spec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line', point: true },
        data: [],
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Area mark computation tests
// ---------------------------------------------------------------------------

describe('computeAreaMarks', () => {
  it('produces an AreaMark with a non-empty path for single series', () => {
    const spec = makeSingleSeriesSpec();
    // Change type to 'area' for the renderer (though compute doesn't check type)
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks).toHaveLength(1);
    expect(marks[0].type).toBe('area');
    expect(marks[0].path).toBeTruthy();
    expect(marks[0].path.length).toBeGreaterThan(0);
  });

  it('area mark has top and bottom boundary points', () => {
    const spec = makeSingleSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    const area = marks[0];
    expect(area.topPoints).toHaveLength(3);
    expect(area.bottomPoints).toHaveLength(3);
  });

  it('area fill has appropriate opacity', () => {
    const spec = makeSingleSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks[0].fillOpacity).toBeGreaterThan(0);
    expect(marks[0].fillOpacity).toBeLessThanOrEqual(1);
  });

  it('area with y2 encoding uses y2 field as bottom boundary instead of baseline', () => {
    const spec: NormalizedChartSpec = {
      ...makeSingleSeriesSpec(),
      data: [
        { date: '2020-01-01', value: 80, value_low: 60 },
        { date: '2021-01-01', value: 90, value_low: 70 },
        { date: '2022-01-01', value: 85, value_low: 65 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        y2: { field: 'value_low', type: 'quantitative' },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks).toHaveLength(1);
    // Bottom points should NOT all be at the same baseline y coordinate
    const bottomYValues = marks[0].bottomPoints.map((p) => p.y);
    const allSame = bottomYValues.every((y) => y === bottomYValues[0]);
    expect(allSame).toBe(false);
    // Each bottom point should be between the top point and the chart bottom
    for (let i = 0; i < marks[0].topPoints.length; i++) {
      expect(marks[0].bottomPoints[i].y).toBeGreaterThan(marks[0].topPoints[i].y); // SVG coords: larger y = lower on screen
    }
  });

  it('stacked areas: produces multiple AreaMarks for multi-series with stack: "zero"', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = 'zero';
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks.length).toBeGreaterThanOrEqual(2);
    const seriesKeys = marks.map((m) => m.seriesKey).filter(Boolean);
    expect(seriesKeys).toContain('US');
    expect(seriesKeys).toContain('UK');
  });

  it('stacked (default): produces multiple AreaMarks for multi-series without an explicit stack', () => {
    // v8 VL-aligned default: multi-series with color stacks unless `stack: null | false`.
    const spec = makeMultiSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks).toHaveLength(2);
    const seriesKeys = marks.map((m) => m.seriesKey).filter(Boolean);
    expect(seriesKeys).toContain('US');
    expect(seriesKeys).toContain('UK');
    // Stacked layers should have different baselines (one stacks on top of the other)
    const firstBottom = marks[0].bottomPoints[0]?.y;
    const secondBottom = marks[1].bottomPoints[0]?.y;
    expect(firstBottom).not.toBe(secondBottom);
  });

  it('overlap (stack: null): every series shares the same baseline (no stacking offset)', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = null;
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    // All bottom points across all series should be at the same baseline.
    const baselines = new Set<number>();
    for (const mark of marks) {
      for (const p of mark.bottomPoints) {
        baselines.add(p.y);
      }
    }
    expect(baselines.size).toBe(1);
  });

  it('overlap (stack: null): each series uses a translucent gradient fill', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = null;
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(typeof mark.fill).toBe('object');
      const fill = mark.fill as { gradient: string; stops: { opacity?: number }[] };
      expect(fill.gradient).toBe('linear');
      // Overlap stops are calibrated lower than solo stops so layered bands stay legible.
      expect(fill.stops[0].opacity).toBe(0.14);
      expect(fill.stops[fill.stops.length - 1].opacity).toBe(0);
    }
  });

  it('stack: false opts into overlap rendering, same as stack: null', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = false;
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks).toHaveLength(2);
    const baselines = new Set(marks.flatMap((m) => m.bottomPoints.map((p) => p.y)));
    expect(baselines.size).toBe(1);
  });

  it('stack: true opts into stacked rendering', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = true;
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks).toHaveLength(2);
    // Stacked layers should have different baselines (one stacks on top of the other)
    const firstBottom = marks[0].bottomPoints[0]?.y;
    const secondBottom = marks[1].bottomPoints[0]?.y;
    expect(firstBottom).not.toBe(secondBottom);
  });

  it('solo (single series) uses the richer solo gradient', () => {
    const spec = makeSingleSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks).toHaveLength(1);
    const fill = marks[0].fill as { gradient: string; stops: { opacity?: number }[] };
    expect(fill.gradient).toBe('linear');
    // Solo stops are heavier than overlap stops since there's no overlap.
    expect(fill.stops[0].opacity).toBe(0.2);
    expect(fill.stops[fill.stops.length - 1].opacity).toBe(0);
  });

  it('stacked areas render flat, with no gradient fill', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = 'zero';
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      // A vertical gradient inside a stacked band reads as a value change
      // within the band, which is what the band's height already encodes.
      expect(typeof mark.fill).toBe('string');
      expect(mark.fillOpacity).toBe(0.92);
    }
  });

  it('stacked areas render flat in dark mode too', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = 'zero';
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea, DARK_THEME);

    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(typeof mark.fill).toBe('string');
      expect(mark.fillOpacity).toBe(0.92);
    }
  });

  it('stacked: markDef.fill string still overrides per-layer gradient', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = 'zero';
    spec.markDef = { type: 'area', fill: '#ff00ff' };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    for (const mark of marks) {
      expect(mark.fill).toBe('#ff00ff');
      // Falls back to the historical 0.7 fillOpacity when user supplies flat color
      expect(mark.fillOpacity).toBe(0.7);
    }
  });

  describe('x-axis sorting', () => {
    it('sorts unsorted temporal data for single area', () => {
      const spec: NormalizedChartSpec = {
        ...makeSingleSeriesSpec(),
        data: [
          { date: '2022-01-01', value: 30 },
          { date: '2020-01-01', value: 10 },
          { date: '2021-01-01', value: 40 },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeAreaMarks(spec, scales, chartArea);

      expect(marks).toHaveLength(1);
      for (let i = 1; i < marks[0].topPoints.length; i++) {
        expect(marks[0].topPoints[i].x).toBeGreaterThan(marks[0].topPoints[i - 1].x);
      }
    });

    it('sorts unsorted temporal data for stacked area', () => {
      const base = makeMultiSeriesSpec();
      base.encoding.y!.stack = 'zero';
      const spec: NormalizedChartSpec = {
        ...base,
        data: [
          { date: '2022-01-01', value: 30, country: 'US' },
          { date: '2020-01-01', value: 10, country: 'US' },
          { date: '2021-01-01', value: 40, country: 'US' },
          { date: '2022-01-01', value: 45, country: 'UK' },
          { date: '2020-01-01', value: 15, country: 'UK' },
          { date: '2021-01-01', value: 35, country: 'UK' },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeAreaMarks(spec, scales, chartArea);

      for (const mark of marks) {
        for (let i = 1; i < mark.topPoints.length; i++) {
          expect(mark.topPoints[i].x).toBeGreaterThan(mark.topPoints[i - 1].x);
        }
      }
    });

    it('sorts unsorted temporal data for overlap (stack: null)', () => {
      const base = makeMultiSeriesSpec();
      base.encoding.y!.stack = null;
      const spec: NormalizedChartSpec = {
        ...base,
        data: [
          { date: '2022-01-01', value: 30, country: 'US' },
          { date: '2020-01-01', value: 10, country: 'US' },
          { date: '2021-01-01', value: 40, country: 'US' },
          { date: '2022-01-01', value: 45, country: 'UK' },
          { date: '2020-01-01', value: 15, country: 'UK' },
          { date: '2021-01-01', value: 35, country: 'UK' },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeAreaMarks(spec, scales, chartArea);

      expect(marks).toHaveLength(2);
      for (const mark of marks) {
        for (let i = 1; i < mark.topPoints.length; i++) {
          expect(mark.topPoints[i].x).toBeGreaterThan(mark.topPoints[i - 1].x);
        }
      }
    });

    it('attaches sorted data rows on single area marks', () => {
      const spec: NormalizedChartSpec = {
        ...makeSingleSeriesSpec(),
        data: [
          { date: '2022-01-01', value: 30 },
          { date: '2020-01-01', value: 10 },
          { date: '2021-01-01', value: 40 },
        ],
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeAreaMarks(spec, scales, chartArea);

      const dates = marks[0].data!.map((r) => r.date);
      expect(dates).toEqual(['2020-01-01', '2021-01-01', '2022-01-01']);
    });

    it('sorts stacked area with 3+ series and shuffled dates', () => {
      const spec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line', point: true },
        data: [
          { date: '2022-01-01', value: 30, region: 'A' },
          { date: '2020-01-01', value: 10, region: 'A' },
          { date: '2021-01-01', value: 20, region: 'A' },
          { date: '2021-01-01', value: 25, region: 'B' },
          { date: '2022-01-01', value: 35, region: 'B' },
          { date: '2020-01-01', value: 15, region: 'B' },
          { date: '2022-01-01', value: 40, region: 'C' },
          { date: '2020-01-01', value: 5, region: 'C' },
          { date: '2021-01-01', value: 30, region: 'C' },
        ],
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative', stack: 'zero' },
          color: { field: 'region', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeAreaMarks(spec, scales, chartArea);

      expect(marks).toHaveLength(3);
      for (const mark of marks) {
        for (let i = 1; i < mark.topPoints.length; i++) {
          expect(mark.topPoints[i].x).toBeGreaterThan(mark.topPoints[i - 1].x);
        }
      }
    });

    it('produces identical output for pre-sorted and shuffled single area data', () => {
      const preSorted = makeSingleSeriesSpec();
      const shuffled: NormalizedChartSpec = {
        ...preSorted,
        data: [
          { date: '2021-01-01', value: 40 },
          { date: '2020-01-01', value: 10 },
          { date: '2022-01-01', value: 30 },
        ],
      };

      const preSortedScales = computeScales(preSorted, chartArea, preSorted.data);
      const preSortedMarks = computeAreaMarks(preSorted, preSortedScales, chartArea);

      const shuffledScales = computeScales(shuffled, chartArea, shuffled.data);
      const shuffledMarks = computeAreaMarks(shuffled, shuffledScales, chartArea);

      expect(preSortedMarks[0].topPoints).toEqual(shuffledMarks[0].topPoints);
      expect(preSortedMarks[0].bottomPoints).toEqual(shuffledMarks[0].bottomPoints);
    });
  });

  it('stacked areas: each layer has different baselines', () => {
    const spec = makeMultiSeriesSpec();
    spec.encoding.y!.stack = 'zero';
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    // First layer should start at y=0 baseline, second layer starts higher
    if (marks.length >= 2) {
      const firstBottom = marks[0].bottomPoints[0]?.y;
      const secondBottom = marks[1].bottomPoints[0]?.y;
      // They should be different (stacked offset)
      expect(firstBottom).not.toBe(secondBottom);
    }
  });

  it('stacked areas: y-domain covers the stacked sum, not individual max', () => {
    // Three series each with value 100 at the same x point. The stacked sum
    // is 300, so the y-scale domain must go up to at least 300. Without the
    // stacked domain fix, the domain only reaches 100 and the top layers clip.
    const spec: NormalizedChartSpec = {
      markType: 'area',
      markDef: { type: 'area' },
      data: [
        { date: '2020-01-01', value: 100, group: 'A' },
        { date: '2021-01-01', value: 100, group: 'A' },
        { date: '2020-01-01', value: 100, group: 'B' },
        { date: '2021-01-01', value: 100, group: 'B' },
        { date: '2020-01-01', value: 100, group: 'C' },
        { date: '2021-01-01', value: 100, group: 'C' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', stack: 'zero' },
        color: { field: 'group', type: 'nominal' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '' },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks).toHaveLength(3);

    // The topmost layer's top points should be within the chart area, not
    // clipped beyond it. With a proper stacked domain the y-scale covers
    // 0..300 (niced), so all pixel positions stay within bounds.
    const lastLayer = marks[marks.length - 1];
    for (const pt of lastLayer.topPoints) {
      expect(pt.y).toBeGreaterThanOrEqual(chartArea.y);
      expect(pt.y).toBeLessThanOrEqual(chartArea.y + chartArea.height);
    }
  });

  it('returns empty marks for unparseable temporal data', () => {
    // Quarterly strings like '2022-Q1' are not valid Date strings. The engine
    // should handle this gracefully (empty marks) rather than crashing or
    // producing NaN-filled paths.
    const spec: NormalizedChartSpec = {
      markType: 'area',
      markDef: { type: 'area' },
      data: [
        { quarter: '2022-Q1', revenue: 45, segment: 'Services' },
        { quarter: '2022-Q2', revenue: 52, segment: 'Services' },
        { quarter: '2022-Q1', revenue: 120, segment: 'Products' },
        { quarter: '2022-Q2', revenue: 135, segment: 'Products' },
      ],
      encoding: {
        x: { field: 'quarter', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
        color: { field: 'segment', type: 'nominal' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '' },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    // Should produce empty marks since dates can't be parsed, not crash
    expect(marks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Label computation tests
// ---------------------------------------------------------------------------

describe('computeLineLabels', () => {
  it('produces labels for multi-series line marks', () => {
    const spec = makeMultiSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = allMarks.filter((m): m is LineMark => m.type === 'line');
    const labelMap = computeLineLabels(lineMarks, fullStrategy);

    expect(labelMap.size).toBe(2);
    expect(labelMap.has('US')).toBe(true);
    expect(labelMap.has('UK')).toBe(true);
  });

  it('labels are positioned at end of line', () => {
    const spec = makeMultiSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = allMarks.filter((m): m is LineMark => m.type === 'line');
    const labelMap = computeLineLabels(lineMarks, fullStrategy);

    for (const lineMark of lineMarks) {
      if (!lineMark.seriesKey) continue;
      const lastPoint = lineMark.points[lineMark.points.length - 1];
      const label = labelMap.get(lineMark.seriesKey);
      expect(label).toBeDefined();
      // Label x should be to the right of the last point
      expect(label!.x).toBeGreaterThan(lastPoint.x);
    }
  });

  it('labels are visible at full width', () => {
    const spec = makeMultiSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = allMarks.filter((m): m is LineMark => m.type === 'line');
    const labelMap = computeLineLabels(lineMarks, fullStrategy);

    // At least some labels should be visible
    const labels = Array.from(labelMap.values());
    expect(labels.some((l) => l.visible)).toBe(true);
  });

  it('labels collapse at compact breakpoint', () => {
    const spec = makeMultiSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeLineMarks(spec, scales, chartArea, compactStrategy);

    const lineMarks = allMarks.filter((m): m is LineMark => m.type === 'line');
    const labelMap = computeLineLabels(lineMarks, compactStrategy);

    // At compact, no labels should be produced
    expect(labelMap.size).toBe(0);
  });

  it('collision detection resolves overlapping labels', () => {
    // Create a spec where series end at the same y position
    const spec: NormalizedChartSpec = {
      markType: 'line',
      markDef: { type: 'line', point: true },
      data: [
        { date: '2020-01-01', value: 10, country: 'A' },
        { date: '2021-01-01', value: 30, country: 'A' },
        { date: '2020-01-01', value: 10, country: 'B' },
        { date: '2021-01-01', value: 30, country: 'B' },
        { date: '2020-01-01', value: 10, country: 'C' },
        { date: '2021-01-01', value: 30, country: 'C' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '' },
    };

    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeLineMarks(spec, scales, chartArea, fullStrategy);
    const lineMarks = allMarks.filter((m): m is LineMark => m.type === 'line');
    const labelMap = computeLineLabels(lineMarks, fullStrategy);

    expect(labelMap.size).toBe(3);

    // At least one label should be offset or demoted due to collision
    const labels = Array.from(labelMap.values());
    const positions = labels.map((l) => `${l.x},${l.y}`);
    const uniquePositions = new Set(positions);
    // If collision worked, positions should differ even though anchor points are the same
    expect(uniquePositions.size).toBeGreaterThanOrEqual(2);
  });

  it('skips single series with no seriesKey', () => {
    const spec = makeSingleSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = allMarks.filter((m): m is LineMark => m.type === 'line');
    const labelMap = computeLineLabels(lineMarks, fullStrategy);

    // Single series has no seriesKey, so no label
    expect(labelMap.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// seriesStyles tests
// ---------------------------------------------------------------------------

describe('seriesStyles', () => {
  it('applies dashed line style to a specific series', () => {
    const spec = makeMultiSeriesSpec();
    spec.seriesStyles = { UK: { lineStyle: 'dashed' } };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
    const ukLine = lineMarks.find((m) => m.seriesKey === 'UK');
    const usLine = lineMarks.find((m) => m.seriesKey === 'US');

    expect(ukLine?.strokeDasharray).toBe('6 4');
    expect(usLine?.strokeDasharray).toBeUndefined();
  });

  it('applies dotted line style', () => {
    const spec = makeMultiSeriesSpec();
    spec.seriesStyles = { US: { lineStyle: 'dotted' } };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const usLine = marks.find((m): m is LineMark => m.type === 'line' && m.seriesKey === 'US');
    expect(usLine?.strokeDasharray).toBe('2 3');
  });

  it('hides point markers when showPoints is false', () => {
    const spec = makeMultiSeriesSpec();
    spec.seriesStyles = { UK: { showPoints: false } };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const ukPoints = marks.filter(
      (m): m is PointMark => m.type === 'point' && m.data.country === 'UK',
    );
    const usPoints = marks.filter(
      (m): m is PointMark => m.type === 'point' && m.data.country === 'US',
    );

    // UK points should have r=0 (hidden)
    expect(ukPoints.every((p) => p.r === 0)).toBe(true);
    // US points should still have default radius
    expect(usPoints.every((p) => p.r > 0)).toBe(true);
  });

  it('overrides strokeWidth for a series', () => {
    const spec = makeMultiSeriesSpec();
    spec.seriesStyles = { UK: { strokeWidth: 1.5 } };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
    const ukLine = lineMarks.find((m) => m.seriesKey === 'UK');
    const usLine = lineMarks.find((m) => m.seriesKey === 'US');

    expect(ukLine?.strokeWidth).toBe(1.5);
    expect(usLine?.strokeWidth).toBe(2); // default
  });

  it('sets opacity on a series', () => {
    const spec = makeMultiSeriesSpec();
    spec.seriesStyles = { UK: { opacity: 0.5 } };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const ukLine = marks.find((m): m is LineMark => m.type === 'line' && m.seriesKey === 'UK');
    const usLine = marks.find((m): m is LineMark => m.type === 'line' && m.seriesKey === 'US');

    expect(ukLine?.opacity).toBe(0.5);
    expect(usLine?.opacity).toBeUndefined();
  });

  it('combines multiple style overrides on the same series', () => {
    const spec = makeMultiSeriesSpec();
    spec.seriesStyles = {
      UK: { lineStyle: 'dashed', showPoints: false, strokeWidth: 1, opacity: 0.6 },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const ukLine = marks.find((m): m is LineMark => m.type === 'line' && m.seriesKey === 'UK');
    expect(ukLine?.strokeDasharray).toBe('6 4');
    expect(ukLine?.strokeWidth).toBe(1);
    expect(ukLine?.opacity).toBe(0.6);

    const ukPoints = marks.filter(
      (m): m is PointMark => m.type === 'point' && m.data.country === 'UK',
    );
    expect(ukPoints.every((p) => p.r === 0)).toBe(true);
  });

  it('does not apply styles when seriesStyles is empty', () => {
    const spec = makeMultiSeriesSpec();
    spec.seriesStyles = {};
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
    for (const line of lineMarks) {
      expect(line.strokeDasharray).toBeUndefined();
      expect(line.opacity).toBeUndefined();
      expect(line.strokeWidth).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Sequential (quantitative) color
// ---------------------------------------------------------------------------

describe('sequential color encoding', () => {
  function makeSequentialColorSpec(): NormalizedChartSpec {
    return {
      markType: 'line',
      markDef: { type: 'line' },
      data: [
        { date: '2020-01-01', value: 10 },
        { date: '2021-01-01', value: 40 },
        { date: '2022-01-01', value: 30 },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'value', type: 'quantitative' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '' },
    };
  }

  it('produces a single line mark (no grouping) with sequential color', () => {
    const spec = makeSequentialColorSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = marks.filter((m): m is LineMark => m.type === 'line');
    expect(lineMarks).toHaveLength(1);
    // Should not group into multiple series
    expect(lineMarks[0].seriesKey).toBeUndefined();
  });

  it('auto-shows point marks for sequential color', () => {
    const spec = makeSequentialColorSpec();
    // markDef.point is NOT set, but points should appear anyway for sequential color
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
    expect(pointMarks).toHaveLength(3);
    // Points should be visible (r > 0)
    expect(pointMarks.every((p) => p.r > 0)).toBe(true);
  });

  it('assigns different colors to points based on data value', () => {
    const spec = makeSequentialColorSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
    // The three points have values 10, 40, 30 so should get distinct colors
    const colors = pointMarks.map((p) => p.fill);
    // Min (10) and max (40) should definitely differ
    expect(colors[0]).not.toBe(colors[1]);
  });

  it('handles NaN values gracefully in sequential color', () => {
    const spec = makeSequentialColorSpec();
    spec.data = [
      { date: '2020-01-01', value: 10 },
      { date: '2021-01-01', value: 'not a number' },
      { date: '2022-01-01', value: 30 },
    ];
    const scales = computeScales(spec, chartArea, spec.data);
    // Should not throw
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);
    const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
    // All points should have a valid fill color (string)
    for (const p of pointMarks) {
      expect(typeof p.fill).toBe('string');
      expect(p.fill.length).toBeGreaterThan(0);
    }
  });
});
