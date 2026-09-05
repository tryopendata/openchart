import type { ArcMark, Mark, PointMark, Rect, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../compiler/types';
import { computeTooltipDescriptors } from '../compute';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const _chartArea: Rect = { x: 50, y: 20, width: 500, height: 300 };

function makeLineSpec(): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line' },
    data: [
      { date: '2020-01-01', value: 10, country: 'US' },
      { date: '2021-01-01', value: 40, country: 'US' },
      { date: '2020-01-01', value: 15, country: 'UK' },
      { date: '2021-01-01', value: 35, country: 'UK' },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'country', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

function makeBarSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { category: 'A', value: 100 },
      { category: 'B', value: 200 },
      { category: 'C', value: 150 },
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

function makePieSpec(): NormalizedChartSpec {
  return {
    markType: 'arc',
    markDef: { type: 'arc' },
    data: [
      { segment: 'Alpha', amount: 30 },
      { segment: 'Beta', amount: 50 },
      { segment: 'Gamma', amount: 20 },
    ],
    encoding: {
      y: { field: 'amount', type: 'quantitative' },
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
// Tests
// ---------------------------------------------------------------------------

describe('computeTooltipDescriptors', () => {
  describe('point marks (from line charts)', () => {
    it('generates tooltip for each point mark', () => {
      const spec = makeLineSpec();
      const pointMarks: PointMark[] = [
        {
          type: 'point',
          cx: 100,
          cy: 200,
          r: 3,
          fill: '#1b7fa3',
          stroke: '#fff',
          strokeWidth: 1.5,
          fillOpacity: 0,
          data: { date: '2020-01-01', value: 10, country: 'US' },
          aria: { label: 'point' },
        },
        {
          type: 'point',
          cx: 300,
          cy: 100,
          r: 3,
          fill: '#c44e52',
          stroke: '#fff',
          strokeWidth: 1.5,
          fillOpacity: 0,
          data: { date: '2021-01-01', value: 40, country: 'US' },
          aria: { label: 'point' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, pointMarks);

      expect(descriptors.size).toBe(2);
      expect(descriptors.has('point-0')).toBe(true);
      expect(descriptors.has('point-1')).toBe(true);
    });

    it('tooltip includes formatted values', () => {
      const spec = makeLineSpec();
      const pointMarks: PointMark[] = [
        {
          type: 'point',
          cx: 100,
          cy: 200,
          r: 3,
          fill: '#1b7fa3',
          stroke: '#fff',
          strokeWidth: 1.5,
          data: { date: '2020-01-01', value: 1500, country: 'US' },
          aria: { label: 'point' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, pointMarks);
      const content = descriptors.get('point-0')!;

      // Should have fields for y (value) and x (date)
      expect(content.fields.length).toBeGreaterThanOrEqual(1);

      // The value field should use compact notation (smart default formatting)
      const valueField = content.fields.find((f) => f.label === 'value');
      expect(valueField).toBeDefined();
      expect(valueField!.value).toBe('1.5k');
    });

    it('tooltip title uses temporal x-axis value', () => {
      const spec = makeLineSpec();
      const pointMarks: PointMark[] = [
        {
          type: 'point',
          cx: 100,
          cy: 200,
          r: 3,
          fill: '#1b7fa3',
          stroke: '#fff',
          strokeWidth: 1.5,
          data: { date: '2020-01-01', value: 10, country: 'US' },
          aria: { label: 'point' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, pointMarks);
      const content = descriptors.get('point-0')!;

      // Title should be the date value
      expect(content.title).toBeDefined();
      expect(content.title!.length).toBeGreaterThan(0);
    });
  });

  describe('rect marks (from bar charts)', () => {
    it('generates tooltip for each rect mark', () => {
      const spec = makeBarSpec();
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 100 },
          aria: { label: 'bar' },
        },
        {
          type: 'rect',
          x: 50,
          y: 80,
          width: 400,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'B', value: 200 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);

      expect(descriptors.size).toBe(2);
      expect(descriptors.has('rect-0')).toBe(true);
      expect(descriptors.has('rect-1')).toBe(true);
    });

    it('rect tooltip includes category as title', () => {
      const spec = makeBarSpec();
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 100 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      // Nominal y-axis = category as title
      expect(content.title).toBe('A');
    });
  });

  describe('arc marks (from pie charts)', () => {
    it('generates tooltip for each arc mark', () => {
      const spec = makePieSpec();
      const arcMarks: ArcMark[] = [
        {
          type: 'arc',
          path: 'M0,0L10,0A10,10,0,0,1,0,10Z',
          centroid: { x: 5, y: 5 },
          innerRadius: 0,
          outerRadius: 100,
          startAngle: 0,
          endAngle: 1.5,
          fill: '#1b7fa3',
          stroke: '#fff',
          strokeWidth: 1,
          data: { segment: 'Alpha', amount: 30 },
          aria: { label: 'arc' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, arcMarks);

      expect(descriptors.size).toBe(1);
      expect(descriptors.has('arc-0')).toBe(true);
    });

    it('arc tooltip uses color field as title', () => {
      const spec = makePieSpec();
      const arcMarks: ArcMark[] = [
        {
          type: 'arc',
          path: 'M0,0',
          centroid: { x: 5, y: 5 },
          innerRadius: 0,
          outerRadius: 100,
          startAngle: 0,
          endAngle: 1.5,
          fill: '#1b7fa3',
          stroke: '#fff',
          strokeWidth: 1,
          data: { segment: 'Alpha', amount: 30 },
          aria: { label: 'arc' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, arcMarks);
      const content = descriptors.get('arc-0')!;

      expect(content.title).toBe('Alpha');
    });
  });

  describe('line and area marks', () => {
    it('line marks do not generate tooltips (points do instead)', () => {
      const spec = makeLineSpec();
      const marks: Mark[] = [
        {
          markType: 'line',
          markDef: { type: 'line' },
          points: [
            { x: 100, y: 200 },
            { x: 300, y: 100 },
          ],
          stroke: '#1b7fa3',
          strokeWidth: 2,
          data: [{ date: '2020-01-01', value: 10 }],
          aria: { label: 'line' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, marks);
      expect(descriptors.size).toBe(0);
    });

    it('area marks do not generate tooltips (points do instead)', () => {
      const spec = makeLineSpec();
      const marks: Mark[] = [
        {
          markType: 'area',
          markDef: { type: 'area' },
          topPoints: [{ x: 100, y: 200 }],
          bottomPoints: [{ x: 100, y: 300 }],
          path: 'M0,0',
          fill: '#1b7fa3',
          fillOpacity: 0.3,
          data: [{ date: '2020-01-01', value: 10 }],
          aria: { label: 'area' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, marks);
      expect(descriptors.size).toBe(0);
    });
  });

  describe('explicit tooltip encoding', () => {
    it('uses tooltip array fields instead of auto-generated defaults', () => {
      const spec: NormalizedChartSpec = {
        ...makeBarSpec(),
        encoding: {
          ...makeBarSpec().encoding,
          tooltip: [
            { field: 'category', type: 'nominal' },
            { field: 'value', type: 'quantitative' },
          ],
        },
      };
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 100 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      expect(content.fields).toHaveLength(2);
      expect(content.fields[0].label).toBe('category');
      expect(content.fields[0].value).toBe('A');
      expect(content.fields[1].label).toBe('value');
      expect(content.fields[1].value).toBe('100');
    });

    it('auto-generates tooltip fields when encoding.tooltip is not set', () => {
      const spec = makeBarSpec();
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 100 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      // The nominal y channel is the title, so its row is dropped: a bar
      // tooltip reading "A / category A / value 100" says the category twice.
      expect(content.title).toBe('A');
      const labels = content.fields.map((f) => f.label);
      expect(labels).toEqual(['value']);
    });
  });

  describe('tooltip title and format on encoding channels', () => {
    it('uses channel title as label instead of field name in explicit tooltip', () => {
      const spec: NormalizedChartSpec = {
        ...makeBarSpec(),
        encoding: {
          ...makeBarSpec().encoding,
          tooltip: [
            { field: 'category', type: 'nominal', title: 'Category Name' },
            { field: 'value', type: 'quantitative', title: 'Total Sales' },
          ],
        },
      };
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 100 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      expect(content.fields[0].label).toBe('Category Name');
      expect(content.fields[1].label).toBe('Total Sales');
    });

    it('uses channel format to format values in explicit tooltip', () => {
      const spec: NormalizedChartSpec = {
        ...makeBarSpec(),
        encoding: {
          ...makeBarSpec().encoding,
          tooltip: [{ field: 'value', type: 'quantitative', format: '$,.0f' }],
        },
      };
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 1500 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      expect(content.fields[0].value).toBe('$1,500');
    });

    it('channel title takes precedence over axis.title', () => {
      const spec: NormalizedChartSpec = {
        ...makeBarSpec(),
        encoding: {
          ...makeBarSpec().encoding,
          tooltip: [
            {
              field: 'value',
              type: 'quantitative',
              title: 'Channel Title',
              axis: { title: 'Axis Title' },
            },
          ],
        },
      };
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 100 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      expect(content.fields[0].label).toBe('Channel Title');
    });

    it('channel format takes precedence over axis.format', () => {
      const spec: NormalizedChartSpec = {
        ...makeBarSpec(),
        encoding: {
          ...makeBarSpec().encoding,
          tooltip: [
            {
              field: 'value',
              type: 'quantitative',
              format: ',.0f',
              axis: { format: '.2f' },
            },
          ],
        },
      };
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 1500 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      expect(content.fields[0].value).toBe('1,500');
    });

    it('uses title and format on auto-generated tooltip fields (no explicit tooltip)', () => {
      const spec: NormalizedChartSpec = {
        ...makeBarSpec(),
        encoding: {
          x: { field: 'value', type: 'quantitative', title: 'Sales', format: '$,.0f' },
          y: { field: 'category', type: 'nominal', title: 'Product' },
        },
      };
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 2000 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      // 'Product' is the title channel, so it is not repeated as a row.
      expect(content.title).toBe('A');
      expect(content.fields.find((f) => f.label === 'Product')).toBeUndefined();

      const salesField = content.fields.find((f) => f.label === 'Sales');
      expect(salesField).toBeDefined();
      expect(salesField!.value).toBe('$2,000');
    });

    it('falls back to axis.title when channel title is not set', () => {
      const spec: NormalizedChartSpec = {
        ...makeBarSpec(),
        encoding: {
          ...makeBarSpec().encoding,
          tooltip: [{ field: 'value', type: 'quantitative', axis: { title: 'Axis Label' } }],
        },
      };
      const rectMarks: RectMark[] = [
        {
          type: 'rect',
          x: 50,
          y: 30,
          width: 200,
          height: 40,
          fill: '#1b7fa3',
          data: { category: 'A', value: 100 },
          aria: { label: 'bar' },
        },
      ];

      const descriptors = computeTooltipDescriptors(spec, rectMarks);
      const content = descriptors.get('rect-0')!;

      expect(content.fields[0].label).toBe('Axis Label');
    });
  });

  describe('stacked totals', () => {
    function makeStackedColumnSpec(stack: 'zero' | 'normalize'): NormalizedChartSpec {
      return {
        markType: 'bar',
        markDef: { type: 'bar' },
        data: [
          { month: 'Jan', value: 30, series: 'A' },
          { month: 'Jan', value: 20, series: 'B' },
        ],
        encoding: {
          x: { field: 'month', type: 'nominal' },
          y: { field: 'value', type: 'quantitative', stack },
          color: { field: 'series', type: 'nominal' },
        },
        chrome: {},
        annotations: [],
        responsive: true,
        theme: {},
        darkMode: 'off',
        labels: { density: 'auto', format: '' },
      };
    }

    function stackedRects(): RectMark[] {
      return [
        {
          type: 'rect',
          x: 10,
          y: 100,
          width: 40,
          height: 60,
          fill: '#111111',
          data: { month: 'Jan', value: 30, series: 'A' },
          aria: { label: 'a' },
          stackGroup: 'Jan',
          seriesKey: 'A',
        },
        {
          type: 'rect',
          x: 10,
          y: 40,
          width: 40,
          height: 40,
          fill: '#222222',
          data: { month: 'Jan', value: 20, series: 'B' },
          aria: { label: 'b' },
          stackGroup: 'Jan',
          seriesKey: 'B',
        },
      ];
    }

    it('ends every segment tooltip with the whole bar', () => {
      const descriptors = computeTooltipDescriptors(makeStackedColumnSpec('zero'), stackedRects());

      for (const key of ['rect-0', 'rect-1']) {
        const fields = descriptors.get(key)!.fields;
        const total = fields[fields.length - 1];
        expect(total.role).toBe('total');
        expect(total.label).toBe('Total');
        expect(total.value).toBe('50');
      }
    });

    it('skips the total when the group has only one segment', () => {
      // A one-segment "stack" total just repeats the value above it.
      const single = [stackedRects()[0]];
      const descriptors = computeTooltipDescriptors(makeStackedColumnSpec('zero'), single);
      const fields = descriptors.get('rect-0')!.fields;
      expect(fields.some((f) => f.role === 'total')).toBe(false);
    });

    it('skips the total on a normalized stack', () => {
      const descriptors = computeTooltipDescriptors(
        makeStackedColumnSpec('normalize'),
        stackedRects(),
      );
      const fields = descriptors.get('rect-0')!.fields;
      expect(fields.some((f) => f.role === 'total')).toBe(false);
    });
  });

  describe('empty data', () => {
    it('returns empty map for no marks', () => {
      const spec = makeLineSpec();
      const descriptors = computeTooltipDescriptors(spec, []);
      expect(descriptors.size).toBe(0);
    });
  });
});
