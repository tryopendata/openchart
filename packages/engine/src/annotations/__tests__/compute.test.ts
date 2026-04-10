import type { Annotation, LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../compiler/types';
import { computeScales } from '../../layout/scales';
import { computeAnnotations } from '../compute';

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
      const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Note' }]);
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

      const _px = scales.x?.scale(new Date('2020-01-01'));
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
    it('connector is present by default', () => {
      const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Has connector' }]);
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

    it('connector "to" points near the data position with a small gap', () => {
      const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Connector check' }]);
      const scales = computeScales(spec, chartArea, spec.data);

      const px = scales.x?.scale(new Date('2020-01-01')) as number;
      const py = scales.y?.scale(20) as number;
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const connector = annotations[0].label!.connector!;
      // The "to" endpoint is pulled back along the connector direction by a
      // small gap (~4px), so it won't exactly match the data point.
      const dx = px - connector.to.x;
      const dy = py - connector.to.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThanOrEqual(5);
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
  // Connector origin auto-selection
  // -----------------------------------------------------------------

  describe('connector origin auto-selection', () => {
    it('connector starts from top edge when data point is above label', () => {
      // Push label far below AND to the right so the top-center is unambiguously closest
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

      const label = annotations[0].label!;
      const connector = label.connector!;
      const fontSize = 12; // DEFAULT_ANNOTATION_FONT_SIZE

      // Data point is far above the label, so connector should exit from the top edge
      const topEdgeY = label.y - fontSize;
      expect(connector.from.y).toBeCloseTo(topEdgeY, 0);
    });

    it('connector starts from bottom edge when data point is below label', () => {
      // Push label far above the data point
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

      const label = annotations[0].label!;
      const connector = label.connector!;
      const fontSize = 12;
      const lineHeight = 1.3;
      const lines = label.text.split('\n');

      // Data point is below the label, so connector should exit from the bottom edge
      const bottomEdgeY = label.y - fontSize + lines.length * fontSize * lineHeight;
      expect(connector.from.y).toBeCloseTo(bottomEdgeY, 0);
    });

    it('connector starts from left edge when data point is left of label', () => {
      // Push label far to the right of the data point
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

      const label = annotations[0].label!;
      const connector = label.connector!;

      // Data point is to the left, so connector should exit from the left edge
      // For single-line text, left edge x = label.x
      expect(connector.from.x).toBeCloseTo(label.x, 0);
    });

    it('connector starts from right edge when data point is right of label', () => {
      // Push label far to the left of the data point
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

      const label = annotations[0].label!;
      const connector = label.connector!;

      // Data point is to the right, so connector should exit from the right edge
      // Right edge is at label.x + textWidth
      // For single-line "Left of point" with fontSize=12, weight=400:
      // textWidth = 14 chars * 12 * 0.55 * 1.0 = 92.4
      expect(connector.from.x).toBeGreaterThan(label.x + 50); // well past the center
    });

    it('multi-line text connector uses correct centered bounding box', () => {
      // Multi-line text with label pushed below data point
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

      const label = annotations[0].label!;
      const connector = label.connector!;

      // For multi-line, labelX is the center. The connector should exit
      // from the top-center since data point is above.
      // Top-center x should be at labelX (the center of the multi-line text)
      expect(connector.from.x).toBeCloseTo(label.x, 0);
    });

    it('connector origin changes when label moves to the other side', () => {
      // Same data point, label pushed right vs left
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

      const annotationsRight = computeAnnotations(specRight, scalesRight, chartArea, fullStrategy);
      const annotationsLeft = computeAnnotations(specLeft, scalesLeft, chartArea, fullStrategy);

      const labelRight = annotationsRight[0].label!;
      const labelLeft = annotationsLeft[0].label!;
      const fromRight = labelRight.connector!.from;
      const fromLeft = labelLeft.connector!.from;

      // When label is to the right of data, connector exits from left edge (= label.x)
      expect(fromRight.x).toBeCloseTo(labelRight.x, 0);
      // When label is to the left of data, connector exits from right edge (label.x + textWidth)
      expect(fromLeft.x).toBeGreaterThan(labelLeft.x + 30); // well past the left edge
    });

    it('connectorOffset is still applied on top of auto-selected origin', () => {
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

    it('curve connector still uses right edge regardless of data point position', () => {
      // Push label below and to the right, but curve should still start from right edge
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

      const label = annotations[0].label!;
      const connector = label.connector!;

      // Curve should start from right edge of text, not top edge
      // Right edge x ≈ label.x + textWidth
      // "Curve test" = 10 chars * 12 * 0.57 = 68.4
      expect(connector.from.x).toBeCloseTo(label.x + 68.4, 1);
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
        { type: 'text', x: '2020-01-01', y: 20, text: 'First note' },
        { type: 'text', x: '2020-01-01', y: 20, text: 'Second note' },
      ]);
      const scales = computeScales(spec, chartArea, spec.data);
      const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

      const nudgedLabel = annotations[1].label!;

      // The nudged annotation should still have a connector
      expect(nudgedLabel.connector).toBeDefined();

      // The connector "from" should be near the nudged label position, not the original
      const connFrom = nudgedLabel.connector!.from;
      const labelCenterX = nudgedLabel.x;
      const labelCenterY = nudgedLabel.y;

      // Connector origin should be within a reasonable distance of the label
      const distFromLabel = Math.sqrt(
        (connFrom.x - labelCenterX) ** 2 + (connFrom.y - labelCenterY) ** 2,
      );
      // Should be within the label's bounding box range (text width + height)
      expect(distFromLabel).toBeLessThan(200);
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
        { type: 'text', x: '2020-01-01', y: 20, text: 'Explicit connector', connector: true },
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
      const fontSize = label.style.fontSize ?? 12;
      const fontWeight = label.style.fontWeight ?? 400;
      // Estimate bounds to verify the right edge is within SVG
      const textWidth = label.text
        .split('\n')
        .reduce(
          (max, line) => Math.max(max, line.length * fontSize * (fontWeight >= 600 ? 0.65 : 0.55)),
          0,
        );
      // The label's right edge should not exceed the SVG width
      expect(label.x + textWidth).toBeLessThanOrEqual(svgDimensions.width);
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
      // Place annotation in the center of the chart
      const spec = makeSpec([
        {
          type: 'text',
          x: '2020-06-01',
          y: 25,
          text: 'Centered',
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
