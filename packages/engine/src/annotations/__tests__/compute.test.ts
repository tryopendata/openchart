import type { Annotation, LayoutStrategy, Rect } from '@opendata-ai/core';
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
    type: 'line',
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
      expect(dx).toBe(20);
      expect(dy).toBe(-30);
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
      expect(dx).toBe(20);
      expect(dy).toBe(10);
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
});
