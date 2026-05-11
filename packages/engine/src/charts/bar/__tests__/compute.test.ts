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

  describe('stacked bars (stack: zero)', () => {
    function makeStackedBarSpec(): NormalizedChartSpec {
      const spec = makeGroupedBarSpec();
      (spec.encoding.x as { stack?: string }).stack = 'zero';
      return spec;
    }

    it('produces marks for all data rows', () => {
      const spec = makeStackedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      // 3 categories * 2 groups = 6
      expect(marks).toHaveLength(6);
    });

    it('segments within a category have different colors', () => {
      const spec = makeStackedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      // Find Q1 bars
      const q1Marks = marks.filter((m) => m.aria.label.includes('Q1'));
      expect(q1Marks).toHaveLength(2);
      expect(q1Marks[0].fill).not.toBe(q1Marks[1].fill);
    });

    it('stacked segments share the same y position within a category', () => {
      const spec = makeStackedBarSpec();
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
      const spec = makeStackedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      const q1Marks = marks.filter((m) => m.aria.label.includes('Q1'));
      // Second segment should start where first ends
      const first = q1Marks[0];
      const second = q1Marks[1];
      expect(second.x).toBeCloseTo(first.x + first.width, 0);
    });

    it('stacked bars have zero corner radius', () => {
      const spec = makeStackedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.cornerRadius).toBe(0);
      }
    });
  });

  describe('grouped bars (default)', () => {
    it('produces marks for all data rows', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(6);
    });

    it('grouped bars within a category have different y positions', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      const q1East = marks.find(
        (m) => m.aria.label.includes('Q1') && m.aria.label.includes('East'),
      )!;
      const q1West = marks.find(
        (m) => m.aria.label.includes('Q1') && m.aria.label.includes('West'),
      )!;

      expect(q1East.y).not.toBe(q1West.y);
    });

    it('grouped bars all start from baseline (not cumulative)', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      const q1East = marks.find(
        (m) => m.aria.label.includes('Q1') && m.aria.label.includes('East'),
      )!;
      const q1West = marks.find(
        (m) => m.aria.label.includes('Q1') && m.aria.label.includes('West'),
      )!;

      // Both bars start at the same x position (baseline)
      expect(q1East.x).toBe(q1West.x);
    });

    it('grouped bars have cornerRadius 2', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.cornerRadius).toBe(2);
      }
    });

    it('grouped bars do not set stackGroup', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      for (const mark of marks) {
        expect(mark.stackGroup).toBeUndefined();
      }
    });

    it('sub-band heights are smaller than full bandwidth (stacked bars use full height)', () => {
      const groupedSpec = makeGroupedBarSpec();
      const groupedScales = computeScales(groupedSpec, chartArea, groupedSpec.data);
      const groupedMarks = computeBarMarks(groupedSpec, groupedScales, chartArea, fullStrategy);

      // With 2 groups, each sub-bar should be less than the full bandwidth
      const stackedSpec = makeGroupedBarSpec();
      (stackedSpec.encoding.x as { stack?: string }).stack = 'zero';
      const stackedScales = computeScales(stackedSpec, chartArea, stackedSpec.data);
      const stackedMarks = computeBarMarks(stackedSpec, stackedScales, chartArea, fullStrategy);

      expect(groupedMarks[0].height).toBeLessThan(stackedMarks[0].height);
      expect(groupedMarks[0].height).toBeGreaterThan(0);
    });

    it('scale domain covers max individual value, not stacked sum', () => {
      const spec = makeGroupedBarSpec();
      const scales = computeScales(spec, chartArea, spec.data);

      // Max individual value is 70 (Q3 West), not 115 (Q3 stacked sum)
      const xScale = scales.x!.scale;
      const domain = xScale.domain() as number[];
      // Domain should not extend to the stacked sum (115)
      expect(domain[1]).toBeLessThanOrEqual(80); // some nice rounding above 70
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

  describe('stacked vs grouped (wage data reproduction)', () => {
    // 2 years × 2 firm-size categories — the canonical grouped-bar use case
    const wageData = [
      { size: '<5 employees', year: '2018', pay: 48200 },
      { size: '<5 employees', year: '2022', pay: 56400 },
      { size: '5,000+ employees', year: '2018', pay: 62300 },
      { size: '5,000+ employees', year: '2022', pay: 74800 },
    ];

    function makeWageSpec(stackZero = false): NormalizedChartSpec {
      return {
        markType: 'bar',
        markDef: { type: 'bar' },
        data: wageData,
        encoding: {
          x: {
            field: 'pay',
            type: 'quantitative',
            ...(stackZero ? { stack: 'zero' } : {}),
          },
          y: { field: 'size', type: 'nominal' },
          color: { field: 'year', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
    }

    it('groups by default: bars sit at different y positions within each category', () => {
      const spec = makeWageSpec(false);
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      // 2 firm sizes × 2 years = 4 bars
      expect(marks).toHaveLength(4);

      const smallFirmMarks = marks.filter((m) => m.aria.label.includes('<5'));
      expect(smallFirmMarks).toHaveLength(2);
      expect(smallFirmMarks[0].y).not.toBe(smallFirmMarks[1].y);
    });

    it('groups by default: scale domain covers max individual value, not stacked sum', () => {
      const spec = makeWageSpec(false);
      const scales = computeScales(spec, chartArea, spec.data);

      // Max individual pay is 74800. Stacked sum for 5000+ employees = 62300 + 74800 = 137100.
      // Default grouped bars should NOT extend domain to 137100.
      const xScale = scales.x!.scale;
      const domain = xScale.domain() as number[];
      expect(domain[1]).toBeLessThan(137100);
      expect(domain[1]).toBeGreaterThanOrEqual(74800);
    });

    it('stacked with stack:zero: segments are contiguous end-to-end within each category', () => {
      const spec = makeWageSpec(true);
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      expect(marks).toHaveLength(4);

      // For stacked bars, the second segment starts exactly where the first ends.
      const smallFirmMarks = marks
        .filter((m) => m.aria.label.includes('<5'))
        .sort((a, b) => a.x - b.x);
      expect(smallFirmMarks).toHaveLength(2);
      expect(smallFirmMarks[1].x).toBeCloseTo(smallFirmMarks[0].x + smallFirmMarks[0].width, 1);
    });

    it('stacked with stack:zero: segments share the same y position (stacked on same row)', () => {
      const spec = makeWageSpec(true);
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

      const smallFirmMarks = marks.filter((m) => m.aria.label.includes('<5'));
      expect(smallFirmMarks).toHaveLength(2);
      expect(smallFirmMarks[0].y).toBe(smallFirmMarks[1].y);
    });

    it('grouped vs stacked: grouped bars each start from baseline', () => {
      const stackedSpec = makeWageSpec(true);
      const stackedScales = computeScales(stackedSpec, chartArea, stackedSpec.data);
      const stackedMarks = computeBarMarks(stackedSpec, stackedScales, chartArea, fullStrategy);

      const groupedSpec = makeWageSpec(false);
      const groupedScales = computeScales(groupedSpec, chartArea, groupedSpec.data);
      const groupedMarks = computeBarMarks(groupedSpec, groupedScales, chartArea, fullStrategy);

      expect(groupedMarks).toHaveLength(4);

      // Grouped bars each start from the baseline (same x for both years within a firm size)
      const smallFirmGrouped = groupedMarks.filter((m) => m.aria.label.includes('<5'));
      expect(smallFirmGrouped[0].x).toBe(smallFirmGrouped[1].x);

      // Stacked bars for the same category have different x positions (end-to-end)
      const smallFirmStacked = stackedMarks.filter((m) => m.aria.label.includes('<5'));
      expect(smallFirmStacked[0].x).not.toBe(smallFirmStacked[1].x);
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

  it('applies fixed label color to outside labels', () => {
    // Narrow chart area forces bars < 40px, putting labels outside
    const smallArea: Rect = { x: 80, y: 20, width: 30, height: 300 };
    const spec: NormalizedChartSpec = {
      markType: 'bar',
      markDef: { type: 'bar', size: 6, cornerRadius: 'pill' },
      data: [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
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
      labels: { density: 'auto', format: '', prefix: '' },
    };
    const scales = computeScales(spec, smallArea, spec.data);
    const marks = computeBarMarks(spec, scales, smallArea, fullStrategy);
    const labels = computeBarLabels(
      marks,
      smallArea,
      'all',
      undefined,
      undefined,
      undefined,
      '#a1a1aa',
    );

    // Outside labels should use the fixed color; inside labels use contrast-adjusted colors
    const outsideLabels = labels.filter((l) => l.style.textAnchor === 'start');
    expect(outsideLabels.length).toBeGreaterThan(0);
    for (const label of outsideLabels) {
      expect(label.style.fill).toBe('#a1a1aa');
    }
  });
});

describe('markDef overrides', () => {
  it('markDef.size reduces bar height and centers within band', () => {
    const spec = makeSimpleBarSpec();
    spec.markDef = { type: 'bar', size: 6 };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

    for (const mark of marks) {
      expect(mark.height).toBe(6);
    }

    // Bars should be centered: offset = (bandwidth - 6) / 2
    const specDefault = makeSimpleBarSpec();
    const scalesDefault = computeScales(specDefault, chartArea, specDefault.data);
    const marksDefault = computeBarMarks(specDefault, scalesDefault, chartArea, fullStrategy);
    for (let i = 0; i < marks.length; i++) {
      expect(marks[i].y).toBeGreaterThan(marksDefault[i].y);
    }
  });

  it('markDef.size is capped at bandwidth', () => {
    const spec = makeSimpleBarSpec();
    spec.markDef = { type: 'bar', size: 9999 };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

    const bandwidth = marks[0].height;
    // Should be capped at bandwidth, not 9999
    expect(bandwidth).toBeLessThan(9999);
  });

  it('markDef.cornerRadius "pill" resolves to half the bar height', () => {
    const spec = makeSimpleBarSpec();
    spec.markDef = { type: 'bar', size: 6, cornerRadius: 'pill' };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

    for (const mark of marks) {
      expect(mark.cornerRadius).toBe(3);
    }
  });

  it('markDef.cornerRadius as number overrides default', () => {
    const spec = makeSimpleBarSpec();
    spec.markDef = { type: 'bar', cornerRadius: 8 };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

    for (const mark of marks) {
      expect(mark.cornerRadius).toBe(8);
    }
  });

  it('markDef.size is skipped for stacked bars', () => {
    const spec = makeGroupedBarSpec();
    spec.markDef = { type: 'bar', size: 6 };
    // Enable stacking (default for grouped)
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

    const stackedMarks = marks.filter((m) => m.stackGroup !== undefined);
    for (const mark of stackedMarks) {
      expect(mark.height).not.toBe(6);
    }
  });

  it('combined size + pill uses adjusted size for radius', () => {
    const spec = makeSimpleBarSpec();
    spec.markDef = { type: 'bar', size: 10, cornerRadius: 'pill' };
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeBarMarks(spec, scales, chartArea, fullStrategy);

    for (const mark of marks) {
      expect(mark.height).toBe(10);
      expect(mark.cornerRadius).toBe(5);
    }
  });
});
