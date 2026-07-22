import type { LayoutStrategy, PointMark, Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeScatterMarks } from '../compute';
import { scatterRenderer } from '../index';
import { computeTrendLine } from '../trendline';

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

function makeBasicScatterSpec(): NormalizedChartSpec {
  return {
    markType: 'point',
    markDef: { type: 'point' },
    data: [
      { x: 10, y: 20 },
      { x: 30, y: 50 },
      { x: 50, y: 40 },
      { x: 70, y: 80 },
      { x: 90, y: 60 },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeBubbleSpec(): NormalizedChartSpec {
  return {
    markType: 'point',
    markDef: { type: 'point' },
    data: [
      { gdp: 10, life: 60, population: 1000 },
      { gdp: 30, life: 70, population: 5000 },
      { gdp: 50, life: 75, population: 300 },
      { gdp: 70, life: 80, population: 8000 },
    ],
    encoding: {
      x: { field: 'gdp', type: 'quantitative' },
      y: { field: 'life', type: 'quantitative' },
      size: { field: 'population', type: 'quantitative' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeColoredScatterSpec(): NormalizedChartSpec {
  return {
    markType: 'point',
    markDef: { type: 'point' },
    data: [
      { x: 10, y: 20, group: 'A' },
      { x: 30, y: 50, group: 'A' },
      { x: 50, y: 40, group: 'B' },
      { x: 70, y: 80, group: 'B' },
      { x: 90, y: 60, group: 'C' },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'group', type: 'nominal' },
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
// computeScatterMarks tests
// ---------------------------------------------------------------------------

describe('computeScatterMarks', () => {
  describe('basic scatter', () => {
    it('produces one PointMark per data row', () => {
      const spec = makeBasicScatterSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(5);
      expect(marks.every((m) => m.type === 'point')).toBe(true);
    });

    it('point positions are within chart area bounds', () => {
      const spec = makeBasicScatterSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.cx).toBeGreaterThanOrEqual(chartArea.x);
        expect(mark.cx).toBeLessThanOrEqual(chartArea.x + chartArea.width);
        expect(mark.cy).toBeGreaterThanOrEqual(chartArea.y);
        expect(mark.cy).toBeLessThanOrEqual(chartArea.y + chartArea.height);
      }
    });

    it('points have default radius when no size encoding', () => {
      const spec = makeBasicScatterSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.r).toBe(5);
      }
    });

    it('points have partial fill opacity for overlap visibility', () => {
      const spec = makeBasicScatterSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.fillOpacity).toBeGreaterThan(0);
        expect(mark.fillOpacity).toBeLessThan(1);
      }
    });

    it('each point has an aria label with field values', () => {
      const spec = makeBasicScatterSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      expect(marks[0].aria.label).toContain('x=10');
      expect(marks[0].aria.label).toContain('y=20');
    });
  });

  describe('bubble variant (size encoding)', () => {
    it('points have varying radii based on size field', () => {
      const spec = makeBubbleSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      const radii = marks.map((m) => m.r);
      const uniqueRadii = new Set(radii);
      expect(uniqueRadii.size).toBeGreaterThan(1);
    });

    it('larger size values produce larger radii', () => {
      const spec = makeBubbleSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      // population: 8000 should have largest radius
      const largest = marks.find((m) => m.data.population === 8000)!;
      const smallest = marks.find((m) => m.data.population === 300)!;
      expect(largest.r).toBeGreaterThan(smallest.r);
    });

    it('aria label includes size field', () => {
      const spec = makeBubbleSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      expect(marks[0].aria.label).toContain('population=');
    });

    it('explicit size domain keeps the largest datum below the max radius', () => {
      const base = makeBubbleSpec();
      // Widen the domain past the data max (8000) so nothing reaches radius 30.
      const spec: NormalizedChartSpec = {
        ...base,
        encoding: {
          ...base.encoding,
          size: { field: 'population', type: 'quantitative', scale: { domain: [0, 32000] } },
        },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      const largest = marks.find((m) => m.data.population === 8000)!;
      // sqrt(8000/32000) * 30 = 0.5 * 30 = 15, well under the 30px cap.
      expect(largest.r).toBeLessThan(20);
    });

    it('explicit size range caps the radii', () => {
      const base = makeBubbleSpec();
      const spec: NormalizedChartSpec = {
        ...base,
        encoding: {
          ...base.encoding,
          size: { field: 'population', type: 'quantitative', scale: { range: [2, 12] } },
        },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      const maxRadius = Math.max(...marks.map((m) => m.r));
      expect(maxRadius).toBeLessThanOrEqual(12);
    });
  });

  describe('color encoding', () => {
    it('points in different groups have different colors', () => {
      const spec = makeColoredScatterSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      const groupA = marks.find((m) => m.data.group === 'A')!;
      const groupB = marks.find((m) => m.data.group === 'B')!;
      expect(groupA.fill).not.toBe(groupB.fill);
    });

    it('points in the same group share a color', () => {
      const spec = makeColoredScatterSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      const groupAMarks = marks.filter((m) => m.data.group === 'A');
      expect(groupAMarks[0].fill).toBe(groupAMarks[1].fill);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no x encoding', () => {
      const spec: NormalizedChartSpec = {
        markType: 'point',
        markDef: { type: 'point' },
        data: [{ y: 10 }],
        encoding: {
          y: { field: 'y', type: 'quantitative' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });

    it('skips rows with non-finite values', () => {
      const spec: NormalizedChartSpec = {
        markType: 'point',
        markDef: { type: 'point' },
        data: [
          { x: 10, y: 20 },
          { x: NaN, y: 30 },
          { x: 50, y: 40 },
        ],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(2);
    });
  });

  describe('nominal y axis', () => {
    function makeNominalYSpec(): NormalizedChartSpec {
      return {
        markType: 'point',
        markDef: { type: 'point' },
        data: [
          { value: 10, category: 'A' },
          { value: 30, category: 'B' },
          { value: 50, category: 'C' },
        ],
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
    }

    it('produces one PointMark per data row', () => {
      const spec = makeNominalYSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(3);
      expect(marks.every((m) => m.type === 'point')).toBe(true);
    });

    it('positions are within chart area bounds', () => {
      const spec = makeNominalYSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.cx).toBeGreaterThanOrEqual(chartArea.x);
        expect(mark.cx).toBeLessThanOrEqual(chartArea.x + chartArea.width);
        expect(mark.cy).toBeGreaterThanOrEqual(chartArea.y);
        expect(mark.cy).toBeLessThanOrEqual(chartArea.y + chartArea.height);
      }
    });

    it('different categories get different y positions', () => {
      const spec = makeNominalYSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      const yPositions = marks.map((m) => m.cy);
      const uniqueYs = new Set(yPositions);
      expect(uniqueYs.size).toBe(3);
    });
  });

  describe('temporal x axis', () => {
    it('produces marks for temporal x with quantitative y', () => {
      const spec: NormalizedChartSpec = {
        markType: 'point',
        markDef: { type: 'point' },
        data: [
          { date: '2020-01-01', value: 10 },
          { date: '2021-01-01', value: 30 },
          { date: '2022-01-01', value: 20 },
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
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(3);
      for (const mark of marks) {
        expect(mark.cx).toBeGreaterThanOrEqual(chartArea.x);
        expect(mark.cx).toBeLessThanOrEqual(chartArea.x + chartArea.width);
      }
    });
  });

  describe('nominal x axis', () => {
    it('produces marks for nominal x with quantitative y', () => {
      const spec: NormalizedChartSpec = {
        markType: 'point',
        markDef: { type: 'point' },
        data: [
          { category: 'X', value: 10 },
          { category: 'Y', value: 30 },
          { category: 'Z', value: 20 },
        ],
        encoding: {
          x: { field: 'category', type: 'nominal' },
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
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(3);

      // Different categories should produce different x positions
      const xPositions = marks.map((m) => m.cx);
      const uniqueXs = new Set(xPositions);
      expect(uniqueXs.size).toBe(3);
    });
  });

  describe('mark-level constants (no encoding field)', () => {
    const baseData = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ];
    const baseEncoding = {
      x: { field: 'x', type: 'quantitative' as const },
      y: { field: 'y', type: 'quantitative' as const },
    };
    const baseSpec = {
      markType: 'point' as const,
      data: baseData,
      encoding: baseEncoding,
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off' as const,
      labels: { density: 'auto' as const, format: '' },
    };

    it('applies a constant mark.fill to every point when no color field is set', () => {
      const spec: NormalizedChartSpec = {
        ...baseSpec,
        markDef: { type: 'point', fill: '#c1462f' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(2);
      expect(marks.every((m) => m.fill === '#c1462f')).toBe(true);
    });

    it('applies a constant mark.size as the point radius', () => {
      const spec: NormalizedChartSpec = {
        ...baseSpec,
        markDef: { type: 'point', size: 12 },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);
      expect(marks.every((m) => m.r === 12)).toBe(true);
    });

    it('applies a constant mark.opacity and mark.stroke', () => {
      const spec: NormalizedChartSpec = {
        ...baseSpec,
        markDef: { type: 'point', opacity: 0.15, stroke: 'none' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);
      expect(marks.every((m) => m.fillOpacity === 0.15)).toBe(true);
      expect(marks.every((m) => m.stroke === 'none')).toBe(true);
    });

    it('lets an encoding color field win over a constant mark.fill', () => {
      const spec: NormalizedChartSpec = {
        ...baseSpec,
        data: [
          { x: 10, y: 20, grp: 'a' },
          { x: 30, y: 40, grp: 'b' },
        ],
        encoding: {
          ...baseEncoding,
          color: { field: 'grp', type: 'nominal' },
        },
        markDef: { type: 'point', fill: '#c1462f' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy);
      // Two categories -> two distinct scale colors, neither forced to the constant.
      const fills = new Set(marks.map((m) => m.fill));
      expect(fills.size).toBe(2);
      expect(fills.has('#c1462f')).toBe(false);
    });

    it('defaults the point stroke to the theme background on a dark canvas', () => {
      const spec: NormalizedChartSpec = {
        ...baseSpec,
        markDef: { type: 'point' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const theme = { colors: { background: '#09090b' } } as ResolvedTheme;
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy, theme);
      expect(marks.every((m) => m.stroke === '#09090b')).toBe(true);
    });

    it('keeps the white stroke when the theme background is transparent (light canvas)', () => {
      const spec: NormalizedChartSpec = {
        ...baseSpec,
        markDef: { type: 'point' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const theme = { colors: { background: 'transparent' } } as ResolvedTheme;
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy, theme);
      expect(marks.every((m) => m.stroke === '#ffffff')).toBe(true);
    });

    it('lets an explicit mark.stroke override the theme default', () => {
      const spec: NormalizedChartSpec = {
        ...baseSpec,
        markDef: { type: 'point', stroke: '#123456' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const theme = { colors: { background: '#09090b' } } as ResolvedTheme;
      const marks = computeScatterMarks(spec, scales, chartArea, fullStrategy, theme);
      expect(marks.every((m) => m.stroke === '#123456')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// computeTrendLine tests
// ---------------------------------------------------------------------------

describe('computeTrendLine', () => {
  it('produces a LineMark with two points', () => {
    const spec = makeBasicScatterSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const points = computeScatterMarks(spec, scales, chartArea, fullStrategy);
    const trendLine = computeTrendLine(points);

    expect(trendLine).not.toBeNull();
    expect(trendLine!.type).toBe('line');
    expect(trendLine!.points).toHaveLength(2);
  });

  it('trend line spans the full x-range of points', () => {
    const spec = makeBasicScatterSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const points = computeScatterMarks(spec, scales, chartArea, fullStrategy);
    const trendLine = computeTrendLine(points);

    const minCx = Math.min(...points.map((p) => p.cx));
    const maxCx = Math.max(...points.map((p) => p.cx));

    expect(trendLine!.points[0].x).toBeCloseTo(minCx, 1);
    expect(trendLine!.points[1].x).toBeCloseTo(maxCx, 1);
  });

  it('trend line is dashed', () => {
    const spec = makeBasicScatterSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const points = computeScatterMarks(spec, scales, chartArea, fullStrategy);
    const trendLine = computeTrendLine(points);

    expect(trendLine!.strokeDasharray).toBeTruthy();
  });

  it('returns null for fewer than 2 points', () => {
    const singlePoint: PointMark[] = [
      {
        type: 'point',
        cx: 100,
        cy: 100,
        r: 5,
        fill: '#000',
        stroke: '#fff',
        strokeWidth: 1,
        data: {},
        aria: { label: 'test' },
      },
    ];

    expect(computeTrendLine(singlePoint)).toBeNull();
    expect(computeTrendLine([])).toBeNull();
  });
});

describe('trendline opt-out', () => {
  it('renders a trend line by default', () => {
    const spec = makeBasicScatterSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = scatterRenderer(spec, scales, chartArea, fullStrategy, undefined as never);

    expect(marks.some((m) => m.type === 'line')).toBe(true);
  });

  it('suppresses the trend line when mark.trendline is false', () => {
    const base = makeBasicScatterSpec();
    const spec: NormalizedChartSpec = {
      ...base,
      markDef: { type: 'point', trendline: false },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = scatterRenderer(spec, scales, chartArea, fullStrategy, undefined as never);

    expect(marks.some((m) => m.type === 'line')).toBe(false);
    expect(marks.every((m) => m.type === 'point')).toBe(true);
  });

  it('draws the trend line behind the points by default', () => {
    const spec = makeBasicScatterSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = scatterRenderer(spec, scales, chartArea, fullStrategy, undefined as never);

    // First mark renders first, i.e. underneath everything drawn after it.
    expect(marks[0].type).toBe('line');
  });

  it('draws the trend line on top when trendline.layer is "above"', () => {
    const base = makeBasicScatterSpec();
    const spec: NormalizedChartSpec = {
      ...base,
      markDef: { type: 'point', trendline: { layer: 'above' } },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = scatterRenderer(spec, scales, chartArea, fullStrategy, undefined as never);

    // Line still present, but now last so it paints over the point cloud.
    expect(marks.some((m) => m.type === 'line')).toBe(true);
    expect(marks[marks.length - 1].type).toBe('line');
  });

  it('applies the trendline config stroke and strokeWidth to the line mark', () => {
    const base = makeBasicScatterSpec();
    const spec: NormalizedChartSpec = {
      ...base,
      markDef: {
        type: 'point',
        trendline: { layer: 'above', stroke: '#ff00ff', strokeWidth: 3 },
      },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = scatterRenderer(spec, scales, chartArea, fullStrategy, undefined as never);

    const line = marks.find((m) => m.type === 'line');
    expect(line).toBeDefined();
    expect((line as { stroke: string }).stroke).toBe('#ff00ff');
    expect((line as { strokeWidth: number }).strokeWidth).toBe(3);
  });
});
