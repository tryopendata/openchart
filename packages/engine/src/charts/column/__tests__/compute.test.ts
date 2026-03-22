import type { LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeColumnMarks } from '../compute';
import { computeColumnLabels } from '../labels';

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

function makeSimpleColumnSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar', orient: 'vertical' },
    data: [
      { month: 'Jan', sales: 120 },
      { month: 'Feb', sales: 80 },
      { month: 'Mar', sales: 150 },
      { month: 'Apr', sales: 200 },
    ],
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'sales', type: 'quantitative' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeGroupedColumnSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar', orient: 'vertical' },
    data: [
      { month: 'Jan', sales: 120, region: 'North' },
      { month: 'Jan', sales: 80, region: 'South' },
      { month: 'Feb', sales: 90, region: 'North' },
      { month: 'Feb', sales: 110, region: 'South' },
      { month: 'Mar', sales: 150, region: 'North' },
      { month: 'Mar', sales: 130, region: 'South' },
    ],
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'sales', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeNegativeColumnSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar', orient: 'vertical' },
    data: [
      { quarter: 'Q1', growth: 5 },
      { quarter: 'Q2', growth: -3 },
      { quarter: 'Q3', growth: 8 },
      { quarter: 'Q4', growth: -1 },
    ],
    encoding: {
      x: { field: 'quarter', type: 'nominal' },
      y: { field: 'growth', type: 'quantitative' },
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
// computeColumnMarks tests
// ---------------------------------------------------------------------------

describe('computeColumnMarks', () => {
  describe('simple columns', () => {
    it('produces one RectMark per data row', () => {
      const spec = makeSimpleColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(4);
      expect(marks.every((m) => m.type === 'rect')).toBe(true);
    });

    it('columns have positive width and height', () => {
      const spec = makeSimpleColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.width).toBeGreaterThan(0);
        expect(mark.height).toBeGreaterThan(0);
      }
    });

    it('taller columns correspond to larger values', () => {
      const spec = makeSimpleColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      // Apr (200) should be taller than Feb (80)
      const apr = marks.find((m) => m.aria.label.includes('Apr'))!;
      const feb = marks.find((m) => m.aria.label.includes('Feb'))!;
      expect(apr.height).toBeGreaterThan(feb.height);
    });

    it('higher values have lower y positions (SVG coordinates)', () => {
      const spec = makeSimpleColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      const apr = marks.find((m) => m.aria.label.includes('Apr'))!;
      const feb = marks.find((m) => m.aria.label.includes('Feb'))!;
      // Apr (200) should start higher (lower y) than Feb (80)
      expect(apr.y).toBeLessThan(feb.y);
    });

    it('each column has an aria label with category and value', () => {
      const spec = makeSimpleColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      expect(marks[0].aria.label).toContain('Jan');
      expect(marks[0].aria.label).toContain('120');
    });
  });

  describe('stacked columns', () => {
    it('produces marks for all data rows', () => {
      const spec = makeGroupedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      // 3 categories * 2 groups = 6
      expect(marks).toHaveLength(6);
    });

    it('stacked segments within a category have different colors', () => {
      const spec = makeGroupedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      const janMarks = marks.filter((m) => m.aria.label.includes('Jan'));
      expect(janMarks).toHaveLength(2);
      expect(janMarks[0].fill).not.toBe(janMarks[1].fill);
    });

    it('stacked columns within a category share the same x position', () => {
      const spec = makeGroupedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      const janNorth = marks.find(
        (m) => m.aria.label.includes('Jan') && m.aria.label.includes('North'),
      )!;
      const janSouth = marks.find(
        (m) => m.aria.label.includes('Jan') && m.aria.label.includes('South'),
      )!;

      // Stacked columns share the same x position
      expect(janNorth.x).toBe(janSouth.x);
      // But have different y positions (stacked vertically)
      expect(janNorth.y).not.toBe(janSouth.y);
    });
  });

  describe('negative values', () => {
    it('negative columns extend downward from baseline', () => {
      const spec = makeNegativeColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      const q2 = marks.find((m) => m.aria.label.includes('Q2'))!;
      const q1 = marks.find((m) => m.aria.label.includes('Q1'))!;

      // Negative value column should start at a higher y (lower on page = baseline)
      expect(q2.y).toBeGreaterThan(q1.y);
    });

    it('all columns have positive height', () => {
      const spec = makeNegativeColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.height).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no y encoding', () => {
      const spec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar', orient: 'vertical' },
        data: [{ month: 'Jan', sales: 100 }],
        encoding: {
          x: { field: 'month', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });

    it('returns empty array for empty data', () => {
      const spec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar', orient: 'vertical' },
        data: [],
        encoding: {
          x: { field: 'month', type: 'nominal' },
          y: { field: 'sales', type: 'quantitative' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// computeColumnLabels tests
// ---------------------------------------------------------------------------

describe('computeColumnLabels', () => {
  it('produces one label per column mark', () => {
    const spec = makeSimpleColumnSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeColumnLabels(marks, chartArea);

    expect(labels).toHaveLength(marks.length);
  });

  it('labels contain the value text', () => {
    const spec = makeSimpleColumnSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeColumnLabels(marks, chartArea);

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('120');
    expect(texts).toContain('200');
  });

  it('applies d3 label format string', () => {
    const spec = makeSimpleColumnSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeColumnLabels(marks, chartArea, 'auto', '$,.0f');

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('$120');
    expect(texts).toContain('$200');
  });

  it('applies format with trailing zero trim (~)', () => {
    const spec: NormalizedChartSpec = {
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: [
        { company: 'A', cap: 3.1 },
        { company: 'B', cap: 2.85 },
      ],
      encoding: {
        x: { field: 'company', type: 'nominal' },
        y: { field: 'cap', type: 'quantitative' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'all', format: '$,.2~f' },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeColumnLabels(marks, chartArea, 'all', '$,.2~f');

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('$3.1');
    expect(texts).toContain('$2.85');
  });

  it('applies format with literal alpha suffix (e.g. "T")', () => {
    const spec: NormalizedChartSpec = {
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: [
        { company: 'Apple', cap: 3.75 },
        { company: 'Meta', cap: 1.63 },
      ],
      encoding: {
        x: { field: 'company', type: 'nominal' },
        y: { field: 'cap', type: 'quantitative' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'all', format: '$,.2~fT' },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeColumnLabels(marks, chartArea, 'all', '$,.2~fT');

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('$3.75T');
    expect(texts).toContain('$1.63T');
  });

  it('applies format with non-alpha suffix (e.g. "%")', () => {
    const spec = makeSimpleColumnSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeColumnLabels(marks, chartArea, 'auto', '.0f%');

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('120%');
    expect(texts).toContain('200%');
  });
});
