import type { LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computePieMarks } from '../compute';
import { computePieLabels } from '../labels';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const chartArea: Rect = { x: 50, y: 20, width: 400, height: 400 };

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

function makeBasicPieSpec(): NormalizedChartSpec {
  return {
    markType: 'arc',
    markDef: { type: 'arc' },
    data: [
      { category: 'A', value: 40 },
      { category: 'B', value: 30 },
      { category: 'C', value: 20 },
      { category: 'D', value: 10 },
    ],
    encoding: {
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeSmallSlicePieSpec(): NormalizedChartSpec {
  return {
    markType: 'arc',
    markDef: { type: 'arc' },
    data: [
      { category: 'Big', value: 90 },
      { category: 'Medium', value: 7 },
      { category: 'Tiny1', value: 1 },
      { category: 'Tiny2', value: 1 },
      { category: 'Tiny3', value: 1 },
    ],
    encoding: {
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeDonutSpec(): NormalizedChartSpec {
  return {
    markType: 'arc',
    markDef: { type: 'arc', innerRadius: 0.5 },
    data: [
      { segment: 'Desktop', users: 55 },
      { segment: 'Mobile', users: 35 },
      { segment: 'Tablet', users: 10 },
    ],
    encoding: {
      y: { field: 'users', type: 'quantitative' },
      color: { field: 'segment', type: 'nominal' },
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
// computePieMarks tests
// ---------------------------------------------------------------------------

describe('computePieMarks', () => {
  describe('basic pie', () => {
    it('produces ArcMarks for each category', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      expect(marks).toHaveLength(4);
      expect(marks.every((m) => m.type === 'arc')).toBe(true);
    });

    it('arc paths are non-empty strings', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      for (const mark of marks) {
        expect(mark.path).toBeTruthy();
        expect(mark.path.length).toBeGreaterThan(0);
      }
    });

    it('arcs are sorted largest first', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      // First arc should be largest (A: 40)
      const firstArc = marks[0];
      expect(firstArc.aria.label).toContain('A');

      // Arc angles should be in descending order (largest angle first)
      const angles = marks.map((m) => m.endAngle - m.startAngle);
      for (let i = 0; i < angles.length - 1; i++) {
        expect(angles[i]).toBeGreaterThanOrEqual(angles[i + 1] - 0.02); // pad angle tolerance
      }
    });

    it('pie has zero inner radius', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      for (const mark of marks) {
        expect(mark.innerRadius).toBe(0);
      }
    });

    it('arcs have white stroke for separation', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      for (const mark of marks) {
        expect(mark.stroke).toBe('#ffffff');
        expect(mark.strokeWidth).toBeGreaterThan(0);
      }
    });

    it('each arc has aria label with value and percentage', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      expect(marks[0].aria.label).toContain('40');
      expect(marks[0].aria.label).toContain('%');
    });

    it('each arc has a centroid point for label positioning', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      for (const mark of marks) {
        expect(mark.centroid).toBeDefined();
        expect(typeof mark.centroid.x).toBe('number');
        expect(typeof mark.centroid.y).toBe('number');
      }
    });
  });

  describe('small-slice grouping', () => {
    it('groups slices below threshold into "Other"', () => {
      const spec = makeSmallSlicePieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      // Tiny1, Tiny2, Tiny3 are each 1% (< 3% threshold) -> grouped into "Other"
      const labels = marks.map((m) => m.aria.label);
      const otherSlice = labels.find((l) => l.includes('Other'));
      expect(otherSlice).toBeTruthy();

      // Should be 3 marks: Big, Medium, Other
      expect(marks).toHaveLength(3);
    });
  });

  describe('donut variant', () => {
    it('donut has positive inner radius', () => {
      const spec = makeDonutSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, true);

      for (const mark of marks) {
        expect(mark.innerRadius).toBeGreaterThan(0);
      }
    });

    it('donut inner radius is about 60% of outer radius', () => {
      const spec = makeDonutSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, true);

      const ratio = marks[0].innerRadius / marks[0].outerRadius;
      expect(ratio).toBeCloseTo(0.6, 1);
    });
  });

  describe('angle range (startAngle/endAngle)', () => {
    function makeHalfDonutSpec(): NormalizedChartSpec {
      return {
        markType: 'arc',
        markDef: {
          type: 'arc',
          innerRadius: 0.5,
          startAngle: -Math.PI / 2,
          endAngle: Math.PI / 2,
        },
        data: [
          { party: 'Dem', seats: 213 },
          { party: 'GOP', seats: 222 },
        ],
        encoding: {
          y: { field: 'seats', type: 'quantitative' },
          color: { field: 'party', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
    }

    it('defaults to a full circle when startAngle/endAngle are unset', () => {
      const spec = makeBasicPieSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);

      const totalSweep = marks.reduce((sum, m) => sum + (m.endAngle - m.startAngle), 0);
      expect(totalSweep).toBeCloseTo(Math.PI * 2, 1);
    });

    it('restricts the total sweep to the requested half-donut range', () => {
      const spec = makeHalfDonutSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, true);

      const minStart = Math.min(...marks.map((m) => m.startAngle));
      const maxEnd = Math.max(...marks.map((m) => m.endAngle));
      expect(minStart).toBeCloseTo(-Math.PI / 2, 1);
      expect(maxEnd).toBeCloseTo(Math.PI / 2, 1);
    });

    it('half-donut slices still sum proportionally to their seat share', () => {
      const spec = makeHalfDonutSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, true);

      const gopMark = marks.find((m) => m.aria.label.includes('GOP'));
      const demMark = marks.find((m) => m.aria.label.includes('Dem'));
      expect(gopMark).toBeDefined();
      expect(demMark).toBeDefined();
      // 222 seats > 213 seats, so GOP's sweep should be larger.
      const gopSweep = gopMark!.endAngle - gopMark!.startAngle;
      const demSweep = demMark!.endAngle - demMark!.startAngle;
      expect(gopSweep).toBeGreaterThan(demSweep);
    });

    it('half-donut arcs fit within the chart area (non-empty paths, positive radii)', () => {
      const spec = makeHalfDonutSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, true);

      for (const mark of marks) {
        expect(mark.path).toBeTruthy();
        expect(mark.outerRadius).toBeGreaterThan(0);
        expect(mark.innerRadius).toBeGreaterThan(0);
      }
    });

    it('half-donut swept geometry stays within the chart area bounds', () => {
      const spec = makeHalfDonutSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, true);

      const left = chartArea.x;
      const right = chartArea.x + chartArea.width;
      const top = chartArea.y;
      const bottom = chartArea.y + chartArea.height;

      // The -PI/2..PI/2 sweep spans the TOP half-disc: its bounding box is
      // x in [-R, R], y in [-R, 0] relative to center (up is -y here). So the
      // swept extremes are center.x ± R horizontally and [center.y - R,
      // center.y] vertically. All must land inside the chart area.
      for (const mark of marks) {
        const r = mark.outerRadius;
        expect(mark.center.x - r).toBeGreaterThanOrEqual(left - 0.5);
        expect(mark.center.x + r).toBeLessThanOrEqual(right + 0.5);
        expect(mark.center.y - r).toBeGreaterThanOrEqual(top - 0.5);
        expect(mark.center.y).toBeLessThanOrEqual(bottom + 0.5);
        // Centroids (label anchors) must also fall inside the area.
        expect(mark.centroid.x).toBeGreaterThanOrEqual(left);
        expect(mark.centroid.x).toBeLessThanOrEqual(right);
        expect(mark.centroid.y).toBeGreaterThanOrEqual(top);
        expect(mark.centroid.y).toBeLessThanOrEqual(bottom);
      }
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no value encoding', () => {
      const spec: NormalizedChartSpec = {
        markType: 'arc',
        markDef: { type: 'arc' },
        data: [{ category: 'A' }],
        encoding: {
          color: { field: 'category', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);
      expect(marks).toHaveLength(0);
    });

    it('returns empty array for empty data', () => {
      const spec: NormalizedChartSpec = {
        markType: 'arc',
        markDef: { type: 'arc' },
        data: [],
        encoding: {
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'category', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);
      expect(marks).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// computePieLabels tests
// ---------------------------------------------------------------------------

describe('computePieLabels', () => {
  it('produces labels for each arc mark', () => {
    const spec = makeBasicPieSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);
    const labels = computePieLabels(marks, chartArea);

    expect(labels).toHaveLength(marks.length);
  });

  it('labels have connector lines to centroids', () => {
    const spec = makeBasicPieSpec();
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computePieMarks(spec, scales, chartArea, fullStrategy, false);
    const labels = computePieLabels(marks, chartArea);

    const visibleLabels = labels.filter((l) => l.visible);
    for (const label of visibleLabels) {
      expect(label.connector).toBeDefined();
    }
  });
});
