import type { LayoutStrategy, LineMark, PointMark, Rect } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeAreaMarks } from '../area';
import { computeLineMarks } from '../compute';
import { computeLineLabels } from '../labels';

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
    type: 'line',
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
    type: 'line',
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
    type: 'line',
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

    it('point marks have invisible fill (for hover only)', () => {
      const spec = makeSingleSeriesSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

      const pointMarks = marks.filter((m): m is PointMark => m.type === 'point');
      for (const pm of pointMarks) {
        expect(pm.fillOpacity).toBe(0);
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

  describe('edge cases', () => {
    it('returns empty array when no x encoding', () => {
      const spec: NormalizedChartSpec = {
        type: 'line',
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
        type: 'line',
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

  it('stacked areas: produces multiple AreaMarks for multi-series', () => {
    const spec = makeMultiSeriesSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeAreaMarks(spec, scales, chartArea);

    expect(marks.length).toBeGreaterThanOrEqual(2);
    const seriesKeys = marks.map((m) => m.seriesKey).filter(Boolean);
    expect(seriesKeys).toContain('US');
    expect(seriesKeys).toContain('UK');
  });

  it('stacked areas: each layer has different baselines', () => {
    const spec = makeMultiSeriesSpec();
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
      type: 'line',
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
