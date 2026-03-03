import type { LayoutStrategy, PointMark, Rect, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeDotMarks } from '../compute';
import { computeDotLabels } from '../labels';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const chartArea: Rect = { x: 80, y: 20, width: 500, height: 300 };

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

function makeSimpleDotSpec(): NormalizedChartSpec {
  return {
    type: 'dot',
    data: [
      { country: 'USA', score: 85 },
      { country: 'UK', score: 72 },
      { country: 'Japan', score: 90 },
      { country: 'France', score: 68 },
    ],
    encoding: {
      x: { field: 'score', type: 'quantitative' },
      y: { field: 'country', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeColoredDotSpec(): NormalizedChartSpec {
  return {
    type: 'dot',
    data: [
      { item: 'Revenue', value: 120, status: 'good' },
      { item: 'Costs', value: 80, status: 'neutral' },
      { item: 'Profit', value: 40, status: 'good' },
      { item: 'Debt', value: -10, status: 'bad' },
    ],
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'item', type: 'nominal' },
      color: { field: 'status', type: 'nominal' },
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
// computeDotMarks tests
// ---------------------------------------------------------------------------

describe('computeDotMarks', () => {
  describe('simple dot plot', () => {
    it('produces PointMarks and RectMarks (stems)', () => {
      const spec = makeSimpleDotSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const stems = marks.filter((m): m is RectMark => m.type === 'rect');

      expect(points).toHaveLength(4);
      expect(stems).toHaveLength(4);
    });

    it('dot positions reflect data values (higher score = further right)', () => {
      const spec = makeSimpleDotSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const japan = points.find((m) => m.aria.label.includes('Japan'))!;
      const france = points.find((m) => m.aria.label.includes('France'))!;

      // Japan (90) should be further right than France (68)
      expect(japan.cx).toBeGreaterThan(france.cx);
    });

    it('stems connect baseline to dot positions', () => {
      const spec = makeSimpleDotSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const stems = marks.filter((m): m is RectMark => m.type === 'rect');
      for (const stem of stems) {
        expect(stem.width).toBeGreaterThan(0);
        expect(stem.height).toBe(2); // STEM_WIDTH
      }
    });

    it('dots are vertically centered within their band', () => {
      const spec = makeSimpleDotSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      // All dots should be at different y positions (different categories)
      const yPositions = points.map((p) => p.cy);
      const uniqueY = new Set(yPositions);
      expect(uniqueY.size).toBe(4);
    });

    it('dots have consistent radius', () => {
      const spec = makeSimpleDotSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const radii = new Set(points.map((p) => p.r));
      expect(radii.size).toBe(1);
    });

    it('each dot has an aria label with category and value', () => {
      const spec = makeSimpleDotSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      expect(points[0].aria.label).toContain('USA');
      expect(points[0].aria.label).toContain('85');
    });
  });

  describe('dumbbell (multi-series)', () => {
    function makeDumbbellSpec(): NormalizedChartSpec {
      return {
        type: 'dot',
        data: [
          { country: 'USA', rate: 78, gender: 'Male' },
          { country: 'USA', rate: 82, gender: 'Female' },
          { country: 'Japan', rate: 85, gender: 'Male' },
          { country: 'Japan', rate: 90, gender: 'Female' },
          { country: 'Brazil', rate: 60, gender: 'Male' },
          { country: 'Brazil', rate: 65, gender: 'Female' },
        ],
        encoding: {
          x: { field: 'rate', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
          color: { field: 'gender', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
    }

    it('renders connecting bars and dots for multi-series', () => {
      const spec = makeDumbbellSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const bars = marks.filter((m): m is RectMark => m.type === 'rect');

      // 6 data rows = 6 dots
      expect(points).toHaveLength(6);
      // 3 categories = 3 connecting bars
      expect(bars).toHaveLength(3);
    });

    it('connecting bars span from min to max value per category', () => {
      const spec = makeDumbbellSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const bars = marks.filter((m): m is RectMark => m.type === 'rect');
      for (const bar of bars) {
        expect(bar.width).toBeGreaterThan(0);
      }
    });

    it('connecting bars use stem color (gray)', () => {
      const spec = makeDumbbellSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const bars = marks.filter((m): m is RectMark => m.type === 'rect');
      for (const bar of bars) {
        expect(bar.fill).toBe('#cccccc');
      }
    });

    it('dots within same category share the same cy position', () => {
      const spec = makeDumbbellSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const usaDots = points.filter((m) => m.aria.label.includes('USA'));
      expect(usaDots).toHaveLength(2);
      expect(usaDots[0].cy).toBe(usaDots[1].cy);
    });

    it('dots for different series have different fill colors', () => {
      const spec = makeDumbbellSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const maleDot = points.find((m) => m.aria.label.includes('Male'))!;
      const femaleDot = points.find((m) => m.aria.label.includes('Female'))!;
      expect(maleDot.fill).not.toBe(femaleDot.fill);
    });

    it('connecting bars render before dots (lower z-index)', () => {
      const spec = makeDumbbellSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      // First mark should be a rect (connecting bar renders before dots)
      expect(marks[0].type).toBe('rect');
    });

    it('aria labels include category and series name', () => {
      const spec = makeDumbbellSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const usaMale = points.find(
        (m) => m.aria.label.includes('USA') && m.aria.label.includes('Male'),
      );
      expect(usaMale).toBeDefined();
      expect(usaMale!.aria.label).toContain('78');
    });
  });

  describe('negative values', () => {
    it('handles negative values (stem extends left of baseline)', () => {
      const spec = makeColoredDotSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const debtDot = points.find((m) => m.data.item === 'Debt')!;
      const revenueDot = points.find((m) => m.data.item === 'Revenue')!;

      // Debt (-10) should be to the left of Revenue (120)
      expect(debtDot.cx).toBeLessThan(revenueDot.cx);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no x encoding', () => {
      const spec: NormalizedChartSpec = {
        type: 'dot',
        data: [{ country: 'USA', score: 85 }],
        encoding: {
          y: { field: 'country', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });

    it('returns empty array for empty data', () => {
      const spec: NormalizedChartSpec = {
        type: 'dot',
        data: [],
        encoding: {
          x: { field: 'score', type: 'quantitative' },
          y: { field: 'country', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeDotMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// computeDotLabels tests
// ---------------------------------------------------------------------------

describe('computeDotLabels', () => {
  it('produces labels for each dot mark', () => {
    const spec = makeSimpleDotSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeDotMarks(spec, scales, chartArea, fullStrategy);
    const points = allMarks.filter((m): m is PointMark => m.type === 'point');
    const labels = computeDotLabels(points, chartArea);

    expect(labels).toHaveLength(points.length);
  });

  it('labels are positioned to the right of dots', () => {
    const spec = makeSimpleDotSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeDotMarks(spec, scales, chartArea, fullStrategy);
    const points = allMarks.filter((m): m is PointMark => m.type === 'point');
    const labels = computeDotLabels(points, chartArea);

    for (let i = 0; i < labels.length; i++) {
      expect(labels[i].x).toBeGreaterThan(points[i].cx);
    }
  });

  it('labels contain the numeric values', () => {
    const spec = makeSimpleDotSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const allMarks = computeDotMarks(spec, scales, chartArea, fullStrategy);
    const points = allMarks.filter((m): m is PointMark => m.type === 'point');
    const labels = computeDotLabels(points, chartArea);

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('85');
    expect(texts).toContain('90');
  });
});
