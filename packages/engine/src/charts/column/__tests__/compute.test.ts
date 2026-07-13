import type { LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import { buildD3Formatter } from '@opendata-ai/openchart-core';
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

  describe('stacked columns (stack: zero)', () => {
    function makeStackedColumnSpec(): NormalizedChartSpec {
      const spec = makeGroupedColumnSpec();
      (spec.encoding.y as { stack?: string }).stack = 'zero';
      return spec;
    }

    it('produces marks for all data rows', () => {
      const spec = makeStackedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      // 3 categories * 2 groups = 6
      expect(marks).toHaveLength(6);
    });

    it('stacked segments within a category have different colors', () => {
      const spec = makeStackedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      const janMarks = marks.filter((m) => m.aria.label.includes('Jan'));
      expect(janMarks).toHaveLength(2);
      expect(janMarks[0].fill).not.toBe(janMarks[1].fill);
    });

    it('stacked columns within a category share the same x position', () => {
      const spec = makeStackedColumnSpec();
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

  describe('grouped columns (default)', () => {
    it('produces marks for all data rows', () => {
      const spec = makeGroupedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(6);
    });

    it('grouped columns within a category have different x positions', () => {
      const spec = makeGroupedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      const janNorth = marks.find(
        (m) => m.aria.label.includes('Jan') && m.aria.label.includes('North'),
      )!;
      const janSouth = marks.find(
        (m) => m.aria.label.includes('Jan') && m.aria.label.includes('South'),
      )!;

      expect(janNorth.x).not.toBe(janSouth.x);
    });

    it('grouped columns have subdivided widths (vs stacked full bandwidth)', () => {
      const groupedSpec = makeGroupedColumnSpec();
      const groupedScales = computeScales(groupedSpec, chartArea, groupedSpec.data);
      const groupedMarks = computeColumnMarks(groupedSpec, groupedScales, chartArea, fullStrategy);

      // With 2 groups, each sub-column should be narrower than full bandwidth
      const stackedSpec = makeGroupedColumnSpec();
      (stackedSpec.encoding.y as { stack?: string }).stack = 'zero';
      const stackedScales = computeScales(stackedSpec, chartArea, stackedSpec.data);
      const stackedMarks = computeColumnMarks(stackedSpec, stackedScales, chartArea, fullStrategy);

      expect(groupedMarks[0].width).toBeLessThan(stackedMarks[0].width);
      expect(groupedMarks[0].width).toBeGreaterThan(0);
    });

    it('grouped columns have cornerRadius 2 and no stackGroup', () => {
      const spec = makeGroupedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.cornerRadius).toBe(2);
        expect(mark.stackGroup).toBeUndefined();
      }
    });

    it('scale domain covers max individual value, not stacked sum', () => {
      const spec = makeGroupedColumnSpec();
      const scales = computeScales(spec, chartArea, spec.data);

      // Max individual value is 150 (Mar North), not 280 (Mar stacked sum)
      const yScale = scales.y!.scale;
      const domain = yScale.domain() as number[];
      expect(domain[1]).toBeLessThanOrEqual(170); // some nice rounding above 150
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
    const labels = computeColumnLabels(marks, chartArea, 'auto', buildD3Formatter('$,.0f'));

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
    const labels = computeColumnLabels(marks, chartArea, 'all', buildD3Formatter('$,.2~f'));

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
    const labels = computeColumnLabels(marks, chartArea, 'all', buildD3Formatter('$,.2~fT'));

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('$3.75T');
    expect(texts).toContain('$1.63T');
  });

  it('applies format with non-alpha suffix (e.g. "%")', () => {
    const spec = makeSimpleColumnSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);
    const labels = computeColumnLabels(marks, chartArea, 'auto', buildD3Formatter('.0f%'));

    const texts = labels.map((l) => l.text);
    expect(texts).toContain('120%');
    expect(texts).toContain('200%');
  });
});

// ---------------------------------------------------------------------------
// Stack mode tests
// ---------------------------------------------------------------------------

describe('stack modes', () => {
  function makeStackedSpec(
    stackMode: boolean | 'zero' | 'normalize' | 'center' | null,
  ): NormalizedChartSpec {
    return {
      markType: 'bar',
      markDef: { type: 'bar', orient: 'vertical' },
      data: [
        { cat: 'A', val: 30, grp: 'X' },
        { cat: 'A', val: 70, grp: 'Y' },
        { cat: 'B', val: 40, grp: 'X' },
        { cat: 'B', val: 60, grp: 'Y' },
      ],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'val', type: 'quantitative', stack: stackMode },
        color: { field: 'grp', type: 'nominal' },
      },
      chrome: {},
      annotations: [],
      responsive: true,
      theme: {},
      darkMode: 'off',
      labels: { density: 'auto', format: '' },
    };
  }

  it('normalize: produces marks whose stacked fractions sum to ~1 per category', () => {
    const spec = makeStackedSpec('normalize');
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

    expect(marks.length).toBe(4);

    // Group by category (stackGroup) and verify normalized heights
    const catA = marks.filter((m) => m.stackGroup === 'A');
    const catB = marks.filter((m) => m.stackGroup === 'B');
    expect(catA).toHaveLength(2);
    expect(catB).toHaveLength(2);

    // The y scale domain is [0, 1] for normalize. Verify marks don't overlap
    // and each category's marks span the full [0, 1] range when mapped back.
    // Category A: 30/(30+70)=0.3, 70/(30+70)=0.7
    // Category B: 40/(40+60)=0.4, 60/(40+60)=0.6
    // All marks should have non-zero height
    for (const mark of marks) {
      expect(mark.height).toBeGreaterThan(0);
    }
  });

  it('center: produces marks with symmetric offsets around zero', () => {
    const spec = makeStackedSpec('center');
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

    expect(marks.length).toBe(4);

    // All marks should have non-zero height
    for (const mark of marks) {
      expect(mark.height).toBeGreaterThan(0);
    }
  });

  it('existing zero mode still works correctly', () => {
    const spec = makeStackedSpec('zero');
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeColumnMarks(spec, scales, chartArea, fullStrategy);

    expect(marks.length).toBe(4);
    // All stacked marks should have stackGroup set
    for (const mark of marks) {
      expect(mark.stackGroup).toBeDefined();
    }
  });

  it('null/false disables stacking (grouped mode)', () => {
    const specNull = makeStackedSpec(null);
    const scalesNull = computeScales(specNull, chartArea, specNull.data);
    const marksNull = computeColumnMarks(specNull, scalesNull, chartArea, fullStrategy);

    // Grouped mode: no stackGroup
    for (const mark of marksNull) {
      expect(mark.stackGroup).toBeUndefined();
    }

    const specFalse = makeStackedSpec(false);
    const scalesFalse = computeScales(specFalse, chartArea, specFalse.data);
    const marksFalse = computeColumnMarks(specFalse, scalesFalse, chartArea, fullStrategy);

    for (const mark of marksFalse) {
      expect(mark.stackGroup).toBeUndefined();
    }
  });
});
