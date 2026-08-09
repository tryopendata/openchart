import type { Annotation, LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScalePoint } from 'd3-scale';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../compiler/types';
import { computeScales } from '../../layout/scales';
import { computeAnnotations } from '../compute';
import { resolvePosition } from '../position';

// ---------------------------------------------------------------------------
// Fixtures
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

function makeSpec(annotations: Annotation[]): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line' },
    data: [
      { date: '2019-01-01', value: 10 },
      { date: '2020-01-01', value: 20 },
      { date: '2021-01-01', value: 30 },
      { date: '2022-01-01', value: 40 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: {},
    annotations,
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeAnnotations', () => {
  describe('text annotations', () => {
    it('resolves text annotation to pixel position', () => {
      const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Important point' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      expect(annotations[0].type).toBe('text');
      expect(annotations[0].label).toBeDefined();
      expect(annotations[0].label!.text).toBe('Important point');
      expect(annotations[0].label!.visible).toBe(true);
    });

    it('text annotation label has a connector to the data point', () => {
      // The default 8px anchor offset produces a sub-MIN_CONNECTOR_LENGTH stub,
      // which is suppressed. Push the label out so a real leader survives.
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Note', offset: { dx: 0, dy: -60 } },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.connector).toBeDefined();
      expect(annotations[0].label!.connector!.from).toBeDefined();
      expect(annotations[0].label!.connector!.to).toBeDefined();
    });

    it('returns null for text annotation with invalid data value', () => {
      const spec = makeSpec([{ type: 'text', x: 'not-a-date', y: 999, text: 'Missing' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      // Invalid date should result in null annotation (filtered out)
      expect(annotations).toHaveLength(0);
    });

    describe('drop-line connector', () => {
      it('produces a vertical line through the data point with end-anchored text on the left', () => {
        const spec = makeSpec([
          {
            type: 'text',
            x: '2020-01-01',
            y: 20,
            text: 'Peak',
            connector: 'drop-line',
            anchor: 'left',
          },
        ]);
        const scales = computeScales(spec, chartArea, spec.data);
        const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

        const ann = annotations[0];
        const c = ann.label?.connector;
        expect(c).toBeDefined();
        expect(c?.style).toBe('drop-line');
        // Vertical line: from.x === to.x and equals the data point's x
        expect(c?.from.x).toBe(c?.to.x);
        const px = resolvePosition('2020-01-01', scales.x);
        expect(c?.from.x).toBe(px);
        // Label sits to the left of the data point with end anchor
        expect(ann.label?.style.textAnchor).toBe('end');
        expect(ann.label?.x).toBeLessThan(px ?? Infinity);
      });

      it('flips a left-anchored label to the right when there is no room on the left', () => {
        // Place a long label very near the chart-area left edge — left side is too tight
        const spec = makeSpec([
          {
            type: 'text',
            x: '2019-01-01',
            y: 10,
            text: 'A long annotation that needs lots of horizontal room',
            connector: 'drop-line',
            anchor: 'left',
          },
        ]);
        const scales = computeScales(spec, chartArea, spec.data);
        const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

        const ann = annotations[0];
        const px = resolvePosition('2019-01-01', scales.x);
        expect(ann.label?.style.textAnchor).toBe('start');
        expect(ann.label?.x).toBeGreaterThan(px ?? -Infinity);
      });

      it('flips a right-anchored label to the left when there is no room on the right', () => {
        const spec = makeSpec([
          {
            type: 'text',
            x: '2022-01-01',
            y: 40,
            text: 'A long annotation that needs lots of horizontal room',
            connector: 'drop-line',
            anchor: 'right',
          },
        ]);
        const scales = computeScales(spec, chartArea, spec.data);
        const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

        const ann = annotations[0];
        const px = resolvePosition('2022-01-01', scales.x);
        expect(ann.label?.style.textAnchor).toBe('end');
        expect(ann.label?.x).toBeLessThan(px ?? Infinity);
      });

      it('picks the wider side when neither side fits cleanly', () => {
        // Tiny chart area + long label + data point near right edge means
        // neither side can fit the full label. Left side has more room
        // (x=50 ... px), so the auto-flip should land left.
        const tinyArea: typeof chartArea = { x: 50, y: 20, width: 120, height: 200 };
        const spec = makeSpec([
          {
            type: 'text',
            x: '2022-01-01',
            y: 40,
            text: 'A genuinely long annotation label that exceeds both sides',
            connector: 'drop-line',
            anchor: 'right',
          },
        ]);
        const scales = computeScales(spec, tinyArea, spec.data);
        const annotations = computeAnnotations(spec, scales, tinyArea, fullStrategy);

        // anchor=right but the right side is even narrower than left, so flip
        expect(annotations[0].label?.style.textAnchor).toBe('end');
      });

      it('preserves the resolved text-anchor on multi-line drop-line labels', () => {
        const spec = makeSpec([
          {
            type: 'text',
            x: '2020-01-01',
            y: 20,
            text: 'Line one\nLine two',
            connector: 'drop-line',
            anchor: 'left',
          },
        ]);
        const scales = computeScales(spec, chartArea, spec.data);
        const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

        // Engine output retains end anchor; the renderer relies on this to
        // not override it back to middle.
        expect(annotations[0].label?.style.textAnchor).toBe('end');
      });
    });
  });

  describe('range annotations', () => {
    it('resolves x-range annotation to a rect', () => {
      const spec = makeSpec([
        { type: 'range', x1: '2020-01-01', x2: '2021-01-01', label: 'Period' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      expect(annotations[0].type).toBe('range');
      expect(annotations[0].rect).toBeDefined();
      expect(annotations[0].rect!.width).toBeGreaterThan(0);
      // Height should span the full chart area for x-only range
      expect(annotations[0].rect!.height).toBe(chartArea.height);
    });

    it('range annotation has a label', () => {
      const spec = makeSpec([
        { type: 'range', x1: '2020-01-01', x2: '2021-01-01', label: 'Recession' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label).toBeDefined();
      expect(annotations[0].label!.text).toBe('Recession');
    });

    it('range label defaults to 11px / weight 500', () => {
      const spec = makeSpec([
        { type: 'range', x1: '2020-01-01', x2: '2021-01-01', label: 'Period' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.style.fontSize).toBe(11);
      expect(annotations[0].label!.style.fontWeight).toBe(500);
    });

    it('range label honors fontSize and fontWeight overrides', () => {
      const spec = makeSpec([
        {
          type: 'range',
          x1: '2020-01-01',
          x2: '2021-01-01',
          label: 'Period',
          fontSize: 19,
          fontWeight: 600,
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.style.fontSize).toBe(19);
      expect(annotations[0].label!.style.fontWeight).toBe(600);
    });

    it('range has fill and opacity', () => {
      const spec = makeSpec([
        {
          type: 'range',
          x1: '2020-01-01',
          x2: '2021-01-01',
          fill: '#ff0000',
          opacity: 0.2,
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].fill).toBe('#ff0000');
      expect(annotations[0].opacity).toBe(0.2);
    });

    it('uses default fill and opacity when not specified', () => {
      const spec = makeSpec([{ type: 'range', x1: '2020-01-01', x2: '2021-01-01' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].fill).toBeDefined();
      expect(annotations[0].opacity).toBeDefined();
    });

    it('interpolates range position for values between ordinal data points', () => {
      const ordinalSpec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line' },
        data: [
          { year: '2005', value: 10 },
          { year: '2007', value: 20 },
          { year: '2009', value: 30 },
          { year: '2012', value: 40 },
        ],
        encoding: {
          x: { field: 'year', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [{ type: 'range', x1: '2008', x2: '2010', label: 'Interpolated' }],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(ordinalSpec, chartArea, ordinalSpec.data);
      const annotations = computeAnnotations(ordinalSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      expect(annotations[0].rect).toBeDefined();
      expect(annotations[0].rect!.width).toBeGreaterThan(0);

      // Also verify the interpolated range sits between the known data points
      const rangeWithKnownPoints: NormalizedChartSpec = {
        ...ordinalSpec,
        annotations: [{ type: 'range', x1: '2007', x2: '2012', label: 'Known' }],
      };
      const knownAnnotations = computeAnnotations(
        rangeWithKnownPoints,
        scales,
        chartArea,
        fullStrategy,
      );
      // The interpolated range (2008-2010) should be narrower than and inside (2007-2012)
      expect(annotations[0].rect!.width).toBeLessThan(knownAnnotations[0].rect!.width);
      expect(annotations[0].rect!.x).toBeGreaterThan(knownAnnotations[0].rect!.x);
    });

    it('clamps interpolation for values outside the ordinal domain range', () => {
      const ordinalSpec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line' },
        data: [
          { year: '2005', value: 10 },
          { year: '2007', value: 20 },
          { year: '2009', value: 30 },
        ],
        encoding: {
          x: { field: 'year', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [{ type: 'range', x1: '2003', x2: '2011', label: 'Outside range' }],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(ordinalSpec, chartArea, ordinalSpec.data);
      const annotations = computeAnnotations(ordinalSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      expect(annotations[0].rect).toBeDefined();
      expect(annotations[0].rect!.width).toBeGreaterThan(0);
    });

    it('returns null for non-numeric ordinal domain values', () => {
      const catSpec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar', orient: 'vertical' },
        data: [
          { category: 'Jan', value: 10 },
          { category: 'Feb', value: 20 },
          { category: 'Mar', value: 30 },
        ],
        encoding: {
          x: { field: 'category', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [{ type: 'range', x1: 'Jan-15', x2: 'Feb-15', label: 'Non-numeric' }],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(catSpec, chartArea, catSpec.data);
      const annotations = computeAnnotations(catSpec, scales, chartArea, fullStrategy);

      // Non-numeric domain can't interpolate, annotation is dropped
      expect(annotations).toHaveLength(0);
    });

    it('two adjacent point-scale ranges have a non-zero pixel gap between them', () => {
      // Regression: ranges ending/starting at point-scale centers would share the same
      // pixel boundary, visually merging. resolvePositionEdge now extends each range
      // by half a step so adjacent ranges are truly separated.
      const ordinalSpec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line' },
        data: [
          { year: '2006', value: 10 },
          { year: '2008', value: 20 },
          { year: '2010', value: 30 },
          { year: '2012', value: 40 },
          { year: '2020', value: 50 },
          { year: '2022', value: 60 },
        ],
        encoding: {
          x: { field: 'year', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [
          { type: 'range', x1: '2008', x2: '2010', label: 'First range' },
          { type: 'range', x1: '2020', x2: '2022', label: 'Second range' },
        ],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(ordinalSpec, chartArea, ordinalSpec.data);
      const annotations = computeAnnotations(ordinalSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(2);
      const rect1 = annotations[0].rect!;
      const rect2 = annotations[1].rect!;

      // First range must end before second range starts (non-zero gap)
      expect(rect1.x + rect1.width).toBeLessThan(rect2.x);
    });

    it('single range on point-scale ordinal x covers at least a full step', () => {
      // A range spanning a single domain value should be at least step-wide,
      // since resolvePositionEdge extends by half a step on each side.
      const domainValues = ['2006', '2008', '2010', '2012'];
      const ordinalSpec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line' },
        data: domainValues.map((year, i) => ({ year, value: i * 10 })),
        encoding: {
          x: { field: 'year', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [{ type: 'range', x1: '2008', x2: '2010', label: 'Single step' }],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(ordinalSpec, chartArea, ordinalSpec.data);
      const annotations = computeAnnotations(ordinalSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      const rect = annotations[0].rect!;

      // step = chartArea.width / (numPoints - 1) roughly. With 4 points and default 0.5 padding,
      // the step on a point scale = width / (n - 1 + 2*padding) -- but the key property is that
      // the range width should be at least as wide as the distance between two domain centers.
      const xScale = scales.x!.scale as ScalePoint<string>;
      const step = xScale.step();
      expect(rect.width).toBeGreaterThanOrEqual(step);
    });

    it('band-scale (bar chart) range covers full bands, not band centers', () => {
      // On a bar chart the x scale is a band scale. resolvePositionEdge extends from the
      // center (what resolvePosition returns) to the band edge.
      const barSpec: NormalizedChartSpec = {
        markType: 'bar',
        markDef: { type: 'bar', orient: 'vertical' },
        data: [
          { year: '2008', value: 10 },
          { year: '2010', value: 20 },
          { year: '2012', value: 30 },
          { year: '2014', value: 40 },
        ],
        encoding: {
          x: { field: 'year', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [{ type: 'range', x1: '2010', x2: '2012', label: 'Band range' }],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(barSpec, chartArea, barSpec.data);
      const annotations = computeAnnotations(barSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      const rect = annotations[0].rect!;

      const bandScale = scales.x!.scale as ScaleBand<string>;
      const bandwidth = bandScale.bandwidth();
      const x1BandStart = bandScale('2010')!;
      const x2BandStart = bandScale('2012')!;

      // Left edge should be at the start of the 2010 band (not the center)
      expect(rect.x).toBeCloseTo(x1BandStart, 1);
      // Right edge should be at the end of the 2012 band
      expect(rect.x + rect.width).toBeCloseTo(x2BandStart + bandwidth, 1);
    });

    it('extendToEdges:false anchors a point-scale range at data point centers', () => {
      // With extendToEdges:false the band starts/ends exactly at the first/last
      // data point centers instead of extending half a step to the plot edge.
      // A line/area mark's point scale has no outer padding by default (the
      // trend should run flush to the axis, not float with scatter-style
      // margin), so here the first/last centers land exactly on the plot edges
      // rather than inset from them.
      const domainValues = ['2006', '2008', '2010', '2012'];
      const ordinalSpec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line' },
        data: domainValues.map((year, i) => ({ year, value: i * 10 })),
        encoding: {
          x: { field: 'year', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        chrome: {},
        annotations: [{ type: 'range', x1: '2006', x2: '2012', extendToEdges: false }],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(ordinalSpec, chartArea, ordinalSpec.data);
      const annotations = computeAnnotations(ordinalSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      const rect = annotations[0].rect!;

      const xScale = scales.x!.scale as ScalePoint<string>;
      // Left/right edges land at the point centers, not extended past them.
      expect(rect.x).toBeCloseTo(xScale('2006')!, 1);
      expect(rect.x + rect.width).toBeCloseTo(xScale('2012')!, 1);
      // And those centers are themselves flush with the plot edges (zero outer
      // padding on a line-mark point scale), not inset from them.
      expect(rect.x).toBeCloseTo(chartArea.x, 1);
      expect(rect.x + rect.width).toBeCloseTo(chartArea.x + chartArea.width, 1);
    });

    it('linear-scale range is unaffected by edge extension', () => {
      // For linear scales, resolvePositionEdge is identical to resolvePosition.
      // This ensures the fix doesn't introduce any drift on continuous axes.
      const linearSpec = makeSpec([{ type: 'range', x1: '2020-01-01', x2: '2021-01-01' }]);
      const scales = computeScales(linearSpec, chartArea, linearSpec.data);
      const annotations = computeAnnotations(linearSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      const rect = annotations[0].rect!;

      // The x positions should exactly match what resolvePosition would return
      const x1Expected = resolvePosition('2020-01-01', scales.x)!;
      const x2Expected = resolvePosition('2021-01-01', scales.x)!;

      expect(rect.x).toBeCloseTo(Math.min(x1Expected, x2Expected), 1);
      expect(rect.x + rect.width).toBeCloseTo(Math.max(x1Expected, x2Expected), 1);
    });

    it('y1/y2 range on ordinal point-scale y-axis has a non-zero pixel gap between two annotations', () => {
      // Horizontal band: y-axis is ordinal (point scale), x-axis is quantitative.
      // Two y-range annotations with a gap should produce two distinct rects.
      const ordinalYSpec: NormalizedChartSpec = {
        markType: 'line',
        markDef: { type: 'line' },
        data: [
          { year: '2006', value: 10 },
          { year: '2008', value: 20 },
          { year: '2010', value: 30 },
          { year: '2015', value: 40 },
          { year: '2020', value: 50 },
          { year: '2022', value: 60 },
        ],
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'year', type: 'ordinal' },
        },
        chrome: {},
        annotations: [
          { type: 'range', y1: '2006', y2: '2008' },
          { type: 'range', y1: '2020', y2: '2022' },
        ],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
      const scales = computeScales(ordinalYSpec, chartArea, ordinalYSpec.data);
      const annotations = computeAnnotations(ordinalYSpec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(2);
      const rects = annotations.map((a) => a.rect!);

      // In SVG, y increases downward. Sort by y so rect[0] is the top one.
      rects.sort((a, b) => a.y - b.y);

      // There must be a non-zero pixel gap between the bottom of rect[0] and top of rect[1]
      const bottomOfFirst = rects[0].y + rects[0].height;
      expect(bottomOfFirst).toBeLessThan(rects[1].y);
    });
  });

  describe('reference line annotations', () => {
    it('resolves horizontal refline at y value', () => {
      const spec = makeSpec([{ type: 'refline', y: 20, label: 'Target' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      expect(annotations[0].type).toBe('refline');
      expect(annotations[0].line).toBeDefined();
      // Horizontal line: start.x = chartArea.x, end.x = chartArea.x + chartArea.width
      expect(annotations[0].line!.start.x).toBe(chartArea.x);
      expect(annotations[0].line!.end.x).toBe(chartArea.x + chartArea.width);
      // Both y values should be the same (horizontal line)
      expect(annotations[0].line!.start.y).toBe(annotations[0].line!.end.y);
    });

    it('resolves vertical refline at x value', () => {
      const spec = makeSpec([{ type: 'refline', x: '2020-06-01', label: 'Event' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      expect(annotations[0].line).toBeDefined();
      // Vertical line: start.y = chartArea.y, end.y = chartArea.y + chartArea.height
      expect(annotations[0].line!.start.y).toBe(chartArea.y);
      expect(annotations[0].line!.end.y).toBe(chartArea.y + chartArea.height);
    });

    it('refline has dashed style by default', () => {
      const spec = makeSpec([{ type: 'refline', y: 20 }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].strokeDasharray).toBeDefined();
    });

    it('refline label defaults to fontSize 11', () => {
      const spec = makeSpec([{ type: 'refline', x: '2020-06-01', label: 'Event' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.style.fontSize).toBe(11);
    });

    it('refline label honors fontSize and fontWeight overrides', () => {
      const spec = makeSpec([
        { type: 'refline', x: '2020-06-01', label: 'Event', fontSize: 24, fontWeight: 600 },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.style.fontSize).toBe(24);
      expect(annotations[0].label!.style.fontWeight).toBe(600);
    });

    it('solid refline has no dasharray', () => {
      const spec = makeSpec([{ type: 'refline', y: 20, style: 'solid' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].strokeDasharray).toBeUndefined();
    });

    it('returns nothing for refline with neither x nor y', () => {
      const spec = makeSpec([{ type: 'refline', label: 'Orphan' } as Annotation]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(0);
    });
  });

  describe('responsive behavior', () => {
    it('returns empty annotations at compact breakpoint', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Hidden' },
        { type: 'range', x1: '2020-01-01', x2: '2021-01-01' },
        { type: 'refline', y: 20 },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, compactStrategy);

      expect(annotations).toHaveLength(0);
    });

    it('keeps annotations at compact breakpoint when autoThin is on', () => {
      const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Kept' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, {
        scales,
        chartArea,
        strategy: compactStrategy,
        isDark: false,
        obstacles: [],
        svg: { width: 320, height: 300 },
        measure: (text, font) => text.length * font.fontSize * 0.6,
        autoThin: true,
      });

      expect(annotations).toHaveLength(1);
      expect(annotations[0].label!.text).toBe('Kept');
    });
  });

  describe('multiple annotations', () => {
    it('resolves multiple mixed annotations', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Note' },
        { type: 'range', x1: '2020-01-01', x2: '2021-01-01' },
        { type: 'refline', y: 25 },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(3);
      expect(annotations.map((a) => a.type)).toEqual(['text', 'range', 'refline']);
    });
  });

  describe('empty annotations', () => {
    it('returns empty array when spec has no annotations', () => {
      const spec = makeSpec([]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // Fine-grained positioning (offset, anchor, connector, zIndex)
  // -----------------------------------------------------------------

  describe('text annotation offset', () => {
    it('applies dx/dy offset to text annotation position', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Offset label',
          offset: { dx: 20, dy: -30 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      // Compute with and without offset
      const specNoOffset = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'No offset' }]);
      const withOffset = computeAnnotations(spec, scales, chartArea, fullStrategy);
      const withoutOffset = computeAnnotations(specNoOffset, scales, chartArea, fullStrategy);

      expect(withOffset).toHaveLength(1);
      expect(withoutOffset).toHaveLength(1);

      // The offset annotation should be shifted by the dx/dy amount
      const dx = withOffset[0].label!.x - withoutOffset[0].label!.x;
      const dy = withOffset[0].label!.y - withoutOffset[0].label!.y;
      expect(dx).toBeCloseTo(20);
      expect(dy).toBeCloseTo(-30);
    });
  });

  describe('text annotation anchor', () => {
    it('anchor "top" places label above the data point', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Above', anchor: 'top' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const py = scales.y?.scale(20);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      // Label y should be above the data point y
      expect(annotations[0].label!.y).toBeLessThan(py as number);
    });

    it('anchor "bottom" places label below the data point', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Below', anchor: 'bottom' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const py = scales.y?.scale(20);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      // Label y should be below the data point y
      expect(annotations[0].label!.y).toBeGreaterThan(py as number);
    });

    it('anchor "left" places label to the left of the data point', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Left', anchor: 'left' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const px = scales.x?.scale(new Date('2020-01-01'));
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      // Label x should be to the left of the data point x
      expect(annotations[0].label!.x).toBeLessThan(px as number);
    });

    it('anchor "right" places label to the right of the data point', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Right', anchor: 'right' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const px = scales.x?.scale(new Date('2020-01-01'));
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(1);
      // Label x should be to the right of the data point x
      expect(annotations[0].label!.x).toBeGreaterThan(px as number);
    });
  });

  describe('text annotation connector', () => {
    it('connector is present by default once the label clears the data point', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Has connector',
          offset: { dx: 0, dy: -60 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.connector).toBeDefined();
    });

    it('connector can be disabled', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'No connector', connector: false },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.connector).toBeUndefined();
    });

    it('connector "to" stops short of the endpoint marker', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Connector check',
          offset: { dx: 0, dy: -60 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const px = scales.x?.scale(new Date('2020-01-01')) as number;
      const py = scales.y?.scale(20) as number;
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const resolved = annotations[0];
      const connector = resolved.label!.connector!;
      const dot = resolved.dot!;

      // The "to" endpoint is pulled back so the line clears the marker's edge
      // instead of piercing it.
      const dist = Math.hypot(px - connector.to.x, py - connector.to.y);
      expect(dist).toBeGreaterThan(dot.radius);
      expect(dist).toBeLessThanOrEqual(dot.radius + dot.strokeWidth / 2 + 3 + 0.001);
    });
  });

  describe('zIndex', () => {
    it('annotations are sorted by zIndex', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Low', zIndex: 1 },
        { type: 'refline', y: 25, zIndex: 10 },
        { type: 'range', x1: '2020-01-01', x2: '2021-01-01', zIndex: 5 },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(3);
      // Should be sorted: zIndex 1, 5, 10
      expect(annotations[0].zIndex).toBe(1);
      expect(annotations[1].zIndex).toBe(5);
      expect(annotations[2].zIndex).toBe(10);
    });

    it('annotations without zIndex default to 0', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'After', zIndex: 5 },
        { type: 'refline', y: 25 }, // no zIndex, defaults to 0
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(2);
      // The refline (no zIndex = 0) should come before text (zIndex 5)
      expect(annotations[0].type).toBe('refline');
      expect(annotations[1].type).toBe('text');
    });
  });

  describe('range annotation labelOffset', () => {
    it('applies labelOffset to range annotation label', () => {
      const spec = makeSpec([
        {
          type: 'range',
          x1: '2020-01-01',
          x2: '2021-01-01',
          label: 'Shifted',
          labelOffset: { dx: 20, dy: 10 },
        },
      ]);
      const specNoOffset = makeSpec([
        {
          type: 'range',
          x1: '2020-01-01',
          x2: '2021-01-01',
          label: 'Not shifted',
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const withOffset = computeAnnotations(spec, scales, chartArea, fullStrategy);
      const withoutOffset = computeAnnotations(specNoOffset, scales, chartArea, fullStrategy);

      const dx = withOffset[0].label!.x - withoutOffset[0].label!.x;
      const dy = withOffset[0].label!.y - withoutOffset[0].label!.y;
      expect(dx).toBeCloseTo(20);
      expect(dy).toBeCloseTo(10);
    });
  });

  describe('refline annotation labelOffset', () => {
    it('applies labelOffset to refline label', () => {
      const spec = makeSpec([
        {
          type: 'refline',
          y: 20,
          label: 'Shifted',
          labelOffset: { dx: 15, dy: -10 },
        },
      ]);
      const specNoOffset = makeSpec([
        {
          type: 'refline',
          y: 20,
          label: 'Not shifted',
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const withOffset = computeAnnotations(spec, scales, chartArea, fullStrategy);
      const withoutOffset = computeAnnotations(specNoOffset, scales, chartArea, fullStrategy);

      const dx = withOffset[0].label!.x - withoutOffset[0].label!.x;
      const dy = withOffset[0].label!.y - withoutOffset[0].label!.y;
      expect(dx).toBe(15);
      expect(dy).toBe(-10);
    });
  });

  // -----------------------------------------------------------------
  // Refline labelAnchor positioning
  // -----------------------------------------------------------------

  describe('refline labelAnchor positioning', () => {
    it('horizontal refline: "left" places label at start.x with text-anchor start', () => {
      const spec = makeSpec([{ type: 'refline', y: 20, label: 'Left label', labelAnchor: 'left' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const label = annotations[0].label!;
      // Label x should be near chartArea.x (start of line) + small offset
      expect(label.x).toBeCloseTo(chartArea.x + 4, 0);
      expect(label.style.textAnchor).toBe('start');
    });

    it('horizontal refline: default places label at end.x with text-anchor end', () => {
      const spec = makeSpec([{ type: 'refline', y: 20, label: 'Default label' }]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const label = annotations[0].label!;
      // Label x should be near chartArea.x + chartArea.width (end of line) - small offset
      expect(label.x).toBeCloseTo(chartArea.x + chartArea.width - 4, 0);
      expect(label.style.textAnchor).toBe('end');
    });

    it('horizontal refline: "bottom" places label below the line', () => {
      const specTop = makeSpec([{ type: 'refline', y: 20, label: 'Top', labelAnchor: 'top' }]);
      const specBottom = makeSpec([
        { type: 'refline', y: 20, label: 'Bottom', labelAnchor: 'bottom' },
      ]);
      const scales = computeScales(specTop, chartArea, specTop.data);

      const top = computeAnnotations(specTop, scales, chartArea, fullStrategy);
      const bottom = computeAnnotations(specBottom, scales, chartArea, fullStrategy);

      // Bottom label should be below top label (larger y value)
      expect(bottom[0].label!.y).toBeGreaterThan(top[0].label!.y);
    });

    it('vertical refline: "right" places label with text-anchor end', () => {
      const spec = makeSpec([
        { type: 'refline', x: '2020-06-01', label: 'Right', labelAnchor: 'right' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const label = annotations[0].label!;
      expect(label.style.textAnchor).toBe('end');
    });

    it('vertical refline: "bottom" places label near end.y', () => {
      const specTop = makeSpec([
        { type: 'refline', x: '2020-06-01', label: 'Top', labelAnchor: 'top' },
      ]);
      const specBottom = makeSpec([
        { type: 'refline', x: '2020-06-01', label: 'Bottom', labelAnchor: 'bottom' },
      ]);
      const scales = computeScales(specTop, chartArea, specTop.data);

      const top = computeAnnotations(specTop, scales, chartArea, fullStrategy);
      const bottom = computeAnnotations(specBottom, scales, chartArea, fullStrategy);

      // Bottom label should be further down (near end.y which is chartArea.y + chartArea.height)
      expect(bottom[0].label!.y).toBeGreaterThan(top[0].label!.y);
    });

    it('labelOffset still applies on top of anchor positioning', () => {
      const spec = makeSpec([
        {
          type: 'refline',
          y: 20,
          label: 'Offset left',
          labelAnchor: 'left',
          labelOffset: { dx: 10, dy: -5 },
        },
      ]);
      const specNoOffset = makeSpec([
        { type: 'refline', y: 20, label: 'No offset', labelAnchor: 'left' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const withOffset = computeAnnotations(spec, scales, chartArea, fullStrategy);
      const withoutOffset = computeAnnotations(specNoOffset, scales, chartArea, fullStrategy);

      const dx = withOffset[0].label!.x - withoutOffset[0].label!.x;
      const dy = withOffset[0].label!.y - withoutOffset[0].label!.y;
      expect(dx).toBe(10);
      expect(dy).toBe(-5);
    });
  });

  // -----------------------------------------------------------------
  // Connector origin (ray-box exit with standoff)
  // -----------------------------------------------------------------

  describe('connector origin auto-selection', () => {
    // The origin is now a ray-box intersection plus a CONNECTOR_STANDOFF gap,
    // so it sits just OUTSIDE the edge it exits from rather than on it.
    const STANDOFF = 6;
    const INFLATE = 2;

    it('connector exits above the label when the data point is above it', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Below point',
          anchor: 'bottom',
          offset: { dx: 0, dy: 150 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const ann = annotations[0];
      const connector = ann.label!.connector!;
      const bounds = ann.bounds!;

      expect(connector.exit).toBe('vertical');
      // Origin sits above the (inflated) top edge by the standoff gap.
      expect(connector.from.y).toBeCloseTo(bounds.y - INFLATE - STANDOFF, 0);
    });

    it('connector exits below the label when the data point is below it', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Above point',
          anchor: 'top',
          offset: { dx: 0, dy: -80 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const ann = annotations[0];
      const connector = ann.label!.connector!;
      const bounds = ann.bounds!;

      expect(connector.exit).toBe('vertical');
      expect(connector.from.y).toBeCloseTo(bounds.y + bounds.height + INFLATE + STANDOFF, 0);
    });

    it('connector exits left of the label when the data point is left of it', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Right of point',
          anchor: 'right',
          offset: { dx: 120, dy: 0 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const ann = annotations[0];
      const connector = ann.label!.connector!;
      const bounds = ann.bounds!;

      expect(connector.exit).toBe('horizontal');
      // Origin sits left of the (inflated) left edge by the standoff gap. Asserting
      // only `< bounds.x` would pass for an origin anywhere off to the left, which
      // is what a broken ray-box intersection produces.
      expect(connector.from.x).toBeCloseTo(bounds.x - INFLATE - STANDOFF, 1);
    });

    it('connector exits right of the label when the data point is right of it', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2021-01-01',
          y: 20,
          text: 'Left of point',
          anchor: 'left',
          offset: { dx: -120, dy: 0 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const ann = annotations[0];
      const connector = ann.label!.connector!;
      const bounds = ann.bounds!;

      expect(connector.exit).toBe('horizontal');
      // Mirror of the left-exit case: one standoff gap past the inflated right edge.
      expect(connector.from.x).toBeCloseTo(bounds.x + bounds.width + INFLATE + STANDOFF, 1);
    });

    it('the connector origin always sits outside the annotation block', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'First line\nSecond line',
          anchor: 'bottom',
          offset: { dx: 0, dy: 80 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const ann = annotations[0];
      const { from } = ann.label!.connector!;
      const b = ann.bounds!;
      const inside =
        from.x >= b.x && from.x <= b.x + b.width && from.y >= b.y && from.y <= b.y + b.height;
      expect(inside).toBe(false);
    });

    it('connector origin flips sides when the label moves to the other side', () => {
      const specRight = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Test label',
          anchor: 'right',
          offset: { dx: 120, dy: 0 },
        },
      ]);
      const specLeft = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Test label',
          anchor: 'left',
          offset: { dx: -120, dy: 0 },
        },
      ]);
      const scalesRight = computeScales(specRight, chartArea, specRight.data);
      const scalesLeft = computeScales(specLeft, chartArea, specLeft.data);

      const annRight = computeAnnotations(specRight, scalesRight, chartArea, fullStrategy)[0];
      const annLeft = computeAnnotations(specLeft, scalesLeft, chartArea, fullStrategy)[0];

      // Label right of the point: exit off the left edge.
      expect(annRight.label!.connector!.from.x).toBeLessThan(annRight.bounds!.x);
      // Label left of the point: exit off the right edge.
      expect(annLeft.label!.connector!.from.x).toBeGreaterThan(
        annLeft.bounds!.x + annLeft.bounds!.width,
      );
    });

    it('connectorOffset is still applied on top of the auto-selected origin', () => {
      const specWithOffset = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Offset test',
          anchor: 'bottom',
          offset: { dx: 0, dy: 80 },
          connectorOffset: { from: { dx: 10, dy: 5 } },
        },
      ]);
      const specNoOffset = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Offset test',
          anchor: 'bottom',
          offset: { dx: 0, dy: 80 },
        },
      ]);
      const scales = computeScales(specWithOffset, chartArea, specWithOffset.data);

      const withOffset = computeAnnotations(specWithOffset, scales, chartArea, fullStrategy);
      const withoutOffset = computeAnnotations(specNoOffset, scales, chartArea, fullStrategy);

      const fromWith = withOffset[0].label!.connector!.from;
      const fromWithout = withoutOffset[0].label!.connector!.from;

      expect(fromWith.x - fromWithout.x).toBeCloseTo(10, 0);
      expect(fromWith.y - fromWithout.y).toBeCloseTo(5, 0);
    });

    // Curve connectors used to hardcode a right-edge exit regardless of where the
    // target was; they now use the same ray-box exit as straight connectors.
    it('curve connector exits toward the data point, not always from the right edge', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Curve test',
          anchor: 'bottom',
          offset: { dx: 0, dy: 80 },
          connector: 'curve',
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const ann = annotations[0];
      const connector = ann.label!.connector!;
      const bounds = ann.bounds!;

      // Data point is straight above the label, so the curve leaves the top.
      expect(connector.exit).toBe('vertical');
      expect(connector.from.y).toBeLessThan(bounds.y);
    });
  });

  // -----------------------------------------------------------------
  // Annotation-to-annotation collision resolution
  // -----------------------------------------------------------------

  describe('annotation-to-annotation collision', () => {
    it('nudges second annotation when two overlap at the same data point', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'First note' },
        { type: 'text', x: '2020-01-01', y: 20, text: 'Second note' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(2);

      const label1 = annotations[0].label!;
      const label2 = annotations[1].label!;

      // Both should be visible
      expect(label1.visible).toBe(true);
      expect(label2.visible).toBe(true);

      // Labels should not overlap: their positions should differ
      const samePosition = label1.x === label2.x && label1.y === label2.y;
      expect(samePosition).toBe(false);
    });

    it('nudges second annotation when nearby data points produce overlapping labels', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'First annotation' },
        { type: 'text', x: '2020-01-01', y: 21, text: 'Second annotation' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(2);

      const label1 = annotations[0].label!;
      const label2 = annotations[1].label!;

      // After collision resolution, bounding boxes should not overlap
      // Check that at least one coordinate differs meaningfully
      const dy = Math.abs(label1.y - label2.y);
      const dx = Math.abs(label1.x - label2.x);
      expect(dx + dy).toBeGreaterThan(5);
    });

    it('recomputes connector origin after nudging', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'First note',
          offset: { dx: 0, dy: -60 },
        },
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Second note',
          offset: { dx: 0, dy: -60 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const nudged = annotations[1];
      const nudgedLabel = nudged.label!;

      // The nudged annotation should still have a connector
      expect(nudgedLabel.connector).toBeDefined();

      // The origin must sit just outside the nudged block, not the original one.
      const b = nudged.bounds!;
      const { from } = nudgedLabel.connector!;
      const inside =
        from.x >= b.x && from.x <= b.x + b.width && from.y >= b.y && from.y <= b.y + b.height;
      expect(inside).toBe(false);

      const distFromBlock = Math.min(
        Math.abs(from.y - b.y),
        Math.abs(from.y - (b.y + b.height)),
        Math.abs(from.x - b.x),
        Math.abs(from.x - (b.x + b.width)),
      );
      // The origin clears the NUDGED block by the standoff gap and no more. The ray
      // leaves the box diagonally, so the CONNECTOR_STANDOFF (6) splits across x and
      // y and the perpendicular clearance lands somewhere in (BOX_INFLATE,
      // BOX_INFLATE + CONNECTOR_STANDOFF] = (2, 8]. A connector rebuilt against the
      // pre-nudge bounds strands the origin tens of pixels off the block, which the
      // old 20px window still admitted.
      expect(distFromBlock).toBeGreaterThan(2);
      expect(distFromBlock).toBeLessThanOrEqual(8);
    });

    // The subtitle carries absolute coordinates, so a nudge that only moved the
    // label used to leave the subtitle stranded at the original position.
    it('subtitle moves with a nudged label', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'First note', subtitle: 'Context one' },
        { type: 'text', x: '2020-01-01', y: 20, text: 'Second note', subtitle: 'Context two' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const single = computeAnnotations(
        makeSpec([spec.annotations[1]]),
        scales,
        chartArea,
        fullStrategy,
      )[0];

      const nudged = annotations[1];
      const dx = nudged.label!.x - single.label!.x;
      const dy = nudged.label!.y - single.label!.y;
      expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0);

      // The subtitle shifted by the same delta as its label.
      expect(nudged.subtitle!.x).toBeCloseTo(single.subtitle!.x + dx, 5);
      expect(nudged.subtitle!.y).toBeCloseTo(single.subtitle!.y + dy, 5);

      // And the label/subtitle gap is unchanged.
      expect(nudged.subtitle!.y - nudged.label!.y).toBeCloseTo(
        single.subtitle!.y - single.label!.y,
        5,
      );
    });

    // Auto-placement (compute.ts Pass 2) stamps a new label position from the
    // placement search; the subtitle must land where the search scored it.
    it('subtitle follows an auto-placed label', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Auto placed',
          subtitle: 'Its context line',
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, {
        scales,
        chartArea,
        strategy: fullStrategy,
        isDark: false,
        obstacles: [],
        svg: { width: 600, height: 400 },
        measure: (text, font) => text.length * font.fontSize * 0.6,
      });

      const ann = annotations[0];
      const label = ann.label!;
      const sub = ann.subtitle!;
      const fontSize = label.style.fontSize as number;
      const lineHeight = label.style.lineHeight as number;

      expect(sub.x).toBeCloseTo(label.x, 5);
      expect(sub.y).toBeCloseTo(label.y + fontSize * lineHeight * 1 + 2, 5);
      expect(sub.style.textAnchor).toBe(label.style.textAnchor);
      // The stamped bounds cover both lines.
      expect(ann.bounds!.height).toBeGreaterThan(fontSize * lineHeight);
    });

    it('resolves three overlapping annotations without any collision', () => {
      const spec = makeSpec([
        { type: 'text', x: '2020-01-01', y: 20, text: 'Note A' },
        { type: 'text', x: '2020-01-01', y: 20, text: 'Note B' },
        { type: 'text', x: '2020-01-01', y: 20, text: 'Note C' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(3);

      // All three should be visible
      for (const ann of annotations) {
        expect(ann.label!.visible).toBe(true);
      }

      // All three should have distinct positions
      const positions = annotations.map((a) => `${a.label!.x.toFixed(1)},${a.label!.y.toFixed(1)}`);
      const unique = new Set(positions);
      expect(unique.size).toBe(3);
    });

    it('does not nudge annotations that already have distinct positions', () => {
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 10,
          text: 'Low point',
          anchor: 'bottom',
          offset: { dx: 0, dy: 40 },
        },
        {
          type: 'text',
          x: '2022-01-01',
          y: 40,
          text: 'High point',
          anchor: 'top',
          offset: { dx: 0, dy: -40 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      // Compute once to get positions
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      expect(annotations).toHaveLength(2);

      // These annotations are far apart, so positions should match what they'd
      // be without collision resolution (i.e., not nudged)
      const specSingle1 = makeSpec([spec.annotations[0]]);
      const specSingle2 = makeSpec([spec.annotations[1]]);
      const single1 = computeAnnotations(specSingle1, scales, chartArea, fullStrategy);
      const single2 = computeAnnotations(specSingle2, scales, chartArea, fullStrategy);

      expect(annotations[0].label!.x).toBeCloseTo(single1[0].label!.x, 1);
      expect(annotations[0].label!.y).toBeCloseTo(single1[0].label!.y, 1);
      expect(annotations[1].label!.x).toBeCloseTo(single2[0].label!.x, 1);
      expect(annotations[1].label!.y).toBeCloseTo(single2[0].label!.y, 1);
    });
  });

  // -----------------------------------------------------------------
  // Obstacle avoidance (label bounds as obstacles)
  // -----------------------------------------------------------------

  describe('obstacle avoidance', () => {
    it('nudges annotation away from an obstacle rect at the same position', () => {
      const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Annotation' }]);
      const scales = computeScales(spec, chartArea, spec.data);

      // Place an obstacle rect exactly where the annotation would land
      const withoutObstacles = computeAnnotations(spec, scales, chartArea, fullStrategy);
      const originalLabel = withoutObstacles[0].label!;

      const obstacle: Rect = {
        x: originalLabel.x - 5,
        y: originalLabel.y - 5,
        width: 80,
        height: 30,
      };

      const withObstacles = computeAnnotations(spec, scales, chartArea, fullStrategy, false, [
        obstacle,
      ]);

      expect(withObstacles).toHaveLength(1);
      const nudgedLabel = withObstacles[0].label!;
      expect(nudgedLabel.visible).toBe(true);

      // The annotation should have moved away from the obstacle
      const moved = nudgedLabel.x !== originalLabel.x || nudgedLabel.y !== originalLabel.y;
      expect(moved).toBe(true);
    });

    it('preserves connector style when nudged away from obstacle', () => {
      // connector: true means "straight line" - obstacle avoidance should not change it
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 20,
          text: 'Explicit connector',
          connector: true,
          offset: { dx: 0, dy: -60 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      const withoutObstacles = computeAnnotations(spec, scales, chartArea, fullStrategy);
      const originalLabel = withoutObstacles[0].label!;
      expect(originalLabel.connector).toBeDefined();
      expect(originalLabel.connector!.style).toBe('straight');

      // Place obstacle directly on the annotation to force a nudge
      const obstacle: Rect = {
        x: originalLabel.x - 5,
        y: originalLabel.y - 5,
        width: 80,
        height: 30,
      };

      const withObstacles = computeAnnotations(spec, scales, chartArea, fullStrategy, false, [
        obstacle,
      ]);
      const nudgedLabel = withObstacles[0].label!;
      expect(nudgedLabel.connector).toBeDefined();
      expect(nudgedLabel.connector!.style).toBe('straight');
    });
  });

  // -----------------------------------------------------------------
  // Boundary clamping (SVG edge overflow prevention)
  // -----------------------------------------------------------------

  describe('boundary clamping', () => {
    const svgDimensions = { width: 600, height: 400 };

    it('shifts annotation left when it overflows the right SVG edge', () => {
      // Place annotation at the far right of the chart area so the label
      // text extends past the SVG boundary.
      const spec = makeSpec([
        {
          type: 'text',
          x: '2022-01-01',
          y: 40,
          text: 'This is a long annotation label',
          anchor: 'right',
          offset: { dx: 80, dy: 0 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(
        spec,
        scales,
        chartArea,
        fullStrategy,
        false,
        [],
        svgDimensions,
      );

      expect(annotations).toHaveLength(1);
      const label = annotations[0].label!;
      // Use engine-exported bounds instead of re-deriving text width
      expect(label.bounds).toBeDefined();
      expect(label.bounds!.x + label.bounds!.width).toBeLessThanOrEqual(svgDimensions.width);
    });

    it('shifts annotation down when it overflows the top SVG edge', () => {
      // Place annotation near the top of the chart and push it upward
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-01-01',
          y: 40,
          text: 'Top overflow',
          anchor: 'top',
          offset: { dx: 0, dy: -80 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(
        spec,
        scales,
        chartArea,
        fullStrategy,
        false,
        [],
        svgDimensions,
      );

      expect(annotations).toHaveLength(1);
      const label = annotations[0].label!;
      const fontSize = label.style.fontSize ?? 12;
      // The top of the label bounds (y - fontSize) should be >= 0
      expect(label.y - fontSize).toBeGreaterThanOrEqual(0);
    });

    it('does not modify annotation that is well within bounds', () => {
      // Place annotation in the center of the chart with an explicit offset
      // so it uses the same explicit placement path with and without SVG dims
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-06-01',
          y: 25,
          text: 'Centered',
          offset: { dx: 0, dy: -10 },
        },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);

      // Compute with and without SVG dimensions to verify no change
      const withClamping = computeAnnotations(
        spec,
        scales,
        chartArea,
        fullStrategy,
        false,
        [],
        svgDimensions,
      );
      const withoutClamping = computeAnnotations(spec, scales, chartArea, fullStrategy, false, []);

      expect(withClamping).toHaveLength(1);
      expect(withoutClamping).toHaveLength(1);
      expect(withClamping[0].label!.x).toBe(withoutClamping[0].label!.x);
      expect(withClamping[0].label!.y).toBe(withoutClamping[0].label!.y);
    });
  });
});
