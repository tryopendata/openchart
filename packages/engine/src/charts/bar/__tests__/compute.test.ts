import type { LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeBarMarks } from '../compute';
import { computeBarLabels } from '../labels';

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

function makeSimpleBarSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { category: 'Apple', value: 50 },
      { category: 'Banana', value: 30 },
      { category: 'Cherry', value: 70 },
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

function makeGroupedBarSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { category: 'Q1', value: 50, region: 'East' },
      { category: 'Q1', value: 40, region: 'West' },
      { category: 'Q2', value: 60, region: 'East' },
      { category: 'Q2', value: 55, region: 'West' },
      { category: 'Q3', value: 45, region: 'East' },
      { category: 'Q3', value: 70, region: 'West' },
    ],
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'category', type: 'nominal' },
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

function makeNegativeBarSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { category: 'Growth', value: 15 },
      { category: 'Decline', value: -10 },
      { category: 'Stable', value: 2 },
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

// ---------------------------------------------------------------------------
// computeBarMarks tests
// ---------------------------------------------------------------------------

describe('computeBarMarks', () => {
  describe('simple bars', () => {
    it('produces one RectMark per data row', () => {
      const spec = makeSimpleBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(3);
      expect(marks.every((m) => m.type === 'rect')).toBe(true);
    });

    it('bars have positive width and height', () => {
      const spec = makeSimpleBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.width).toBeGreaterThan(0);
        expect(mark.height).toBeGreaterThan(0);
      }
    });

    it('wider bars correspond to larger values', () => {
      const spec = makeSimpleBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      // Cherry (70) should be wider than Banana (30)
      const cherry = marks.find((m) => m.aria.label.includes('Cherry'))!;
      const banana = marks.find((m) => m.aria.label.includes('Banana'))!;
      expect(cherry.width).toBeGreaterThan(banana.width);
    });

    it('bars have corner radius applied', () => {
      const spec = makeSimpleBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      expect(marks[0].cornerRadius).toBe(2);
    });

    it('each bar has an aria label with category and value', () => {
      const spec = makeSimpleBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      expect(marks[0].aria.label).toContain('Apple');
      expect(marks[0].aria.label).toContain('50');
    });
  });

  describe('stacked bars', () => {
    it('produces marks for all data rows', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      // 3 categories * 2 groups = 6
      expect(marks).toHaveLength(6);
    });

    it('segments within a category have different colors', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      // Find Q1 bars
      const q1Marks = marks.filter((m) => m.aria.label.includes('Q1'));
      expect(q1Marks).toHaveLength(2);
      expect(q1Marks[0].fill).not.toBe(q1Marks[1].fill);
    });

    it('stacked segments share the same y position within a category', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      const q1East = marks.find(
        (m) => m.aria.label.includes('Q1') && m.aria.label.includes('East'),
      )!;
      const q1West = marks.find(
        (m) => m.aria.label.includes('Q1') && m.aria.label.includes('West'),
      )!;

      // Stacked bars share the same y position (full band height)
      expect(q1East.y).toBe(q1West.y);
    });

    it('stacked segments are placed end-to-end horizontally', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      const q1Marks = marks.filter((m) => m.aria.label.includes('Q1'));
      // Second segment should start where first ends
      const first = q1Marks[0];
      const second = q1Marks[1];
      expect(second.x).toBeCloseTo(first.x + first.width, 0);
    });

    it('stacked bars have zero corner radius', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.cornerRadius).toBe(0);
      }
    });
  });

  describe('colored (non-stacked) bars', () => {
    it('renders colored bars when each category has one row with color encoding', () => {
      const spec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar' },
        data: [
          { category: 'Apple', value: 50, type: 'Fruit' },
          { category: 'Banana', value: 30, type: 'Tropical' },
          { category: 'Cherry', value: 70, type: 'Berry' },
        ],
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
          color: { field: 'type', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(3);
      // Each bar should have different colors
      const colors = new Set(marks.map((m) => m.fill));
      expect(colors.size).toBe(3);
      // Non-stacked bars should have corner radius
      expect(marks[0].cornerRadius).toBe(2);
      // Bars should not be stacked (no stackGroup)
      expect(marks[0].stackGroup).toBeUndefined();
    });

    it('handles negative values in colored bars', () => {
      const spec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar' },
        data: [
          { category: 'Growth', value: 15, status: 'positive' },
          { category: 'Decline', value: -10, status: 'negative' },
        ],
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
          color: { field: 'status', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(2);
      const decline = marks.find((m) => m.aria.label.includes('Decline'))!;
      const growth = marks.find((m) => m.aria.label.includes('Growth'))!;
      // Negative bar starts to the left of positive bar
      expect(decline.x).toBeLessThan(growth.x);
      expect(decline.width).toBeGreaterThan(0);
    });
  });

  describe('negative values', () => {
    it('negative bars extend leftward from baseline', () => {
      const spec = makeNegativeBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      const decline = marks.find((m) => m.aria.label.includes('Decline'))!;
      const growth = marks.find((m) => m.aria.label.includes('Growth'))!;

      // Negative bar should start to the left of where positive bar starts
      expect(decline.x).toBeLessThan(growth.x);
    });

    it('negative bars still have positive width', () => {
      const spec = makeNegativeBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.width).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no x encoding', () => {
      const spec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar' },
        data: [{ category: 'A', value: 10 }],
        encoding: {
          y: { field: 'category', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });

    it('returns empty array for empty data', () => {
      const spec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar' },
        data: [],
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
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);
      expect(marks).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// computeBarLabels tests
// ---------------------------------------------------------------------------

describe('computeBarLabels', () => {
  it('produces one label per bar mark', () => {
    const spec = makeSimpleBarSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeBarLabels(marks, chartArea);

    expect(labels).toHaveLength(marks.length);
  });

  it('labels contain the value text', () => {
    const spec = makeSimpleBarSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeBarLabels(marks, chartArea);

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('50');
    expect(texts).toContain('30');
    expect(texts).toContain('70');
  });

  it('applies d3 label format string', () => {
    const spec = makeSimpleBarSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeBarLabels(marks, chartArea, 'auto', '$,.0f');

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('$50');
    expect(texts).toContain('$30');
    expect(texts).toContain('$70');
  });

  it('applies format with literal alpha suffix (e.g. "T")', () => {
    const spec: NormalizedChartSpec = {
      markType: 'bar',
      markDef: { type: 'bar' },
      data: [
        { company: 'Apple', cap: 3.75 },
        { company: 'Meta', cap: 1.63 },
      ],
      encoding: {
        x: { field: 'cap', type: 'quantitative' },
        y: { field: 'company', type: 'nominal' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'all', format: '$,.2~fT' },
    };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeBarLabels(marks, chartArea, 'all', '$,.2~fT');

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('$3.75T');
    expect(texts).toContain('$1.63T');
  });

  it('applies format with non-alpha suffix (e.g. "%")', () => {
    const spec = makeSimpleBarSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeBarLabels(marks, chartArea, 'auto', '.0f%');

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('50%');
    expect(texts).toContain('30%');
    expect(texts).toContain('70%');
  });
});
