import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../../compile';

const options = { width: 680, height: 320, onWarn: () => {} };
const data = [
  {
    day: '2026-10-11',
    category: 'A',
    value: 2,
    upper: 4,
    other: 8,
    text: 'same',
    'Mark ID': 'row-a',
  },
  {
    day: '2026-10-25',
    category: 'A',
    value: 3,
    upper: 5,
    other: 9,
    text: 'same',
    'Mark ID': 'row-b',
  },
];
const temporal = { field: 'day', type: 'temporal' };
const quantitative = { field: 'value', type: 'quantitative' };
const nominal = { field: 'category', type: 'nominal' };
const cases = [
  ['bar', { x: quantitative, y: nominal }],
  ['line', { x: temporal, y: quantitative }],
  ['area', { x: temporal, y: quantitative }],
  ['point', { x: quantitative, y: { field: 'other', type: 'quantitative' } }],
  ['circle', { x: quantitative, y: nominal }],
  ['lollipop', { x: quantitative, y: nominal }],
  ['arc', { theta: quantitative, color: nominal }],
  ['text', { x: quantitative, y: nominal, text: nominal }],
  ['rule', { x: quantitative, x2: { field: 'upper' }, y: nominal }],
  ['tick', { x: quantitative, y: nominal }],
  ['rect', { x: nominal, y: { field: 'day', type: 'nominal' }, color: quantitative }],
  ['range', { x: quantitative, x2: { field: 'upper' }, y: nominal }],
  ['beeswarm', { x: quantitative, y: nominal }],
  ['waffle', { theta: quantitative, color: nominal }],
  ['calendar', { x: temporal, color: quantitative }],
  ['parliament', { theta: quantitative, color: nominal }],
  ['histogram', { x: quantitative }],
  ['density', { x: quantitative }],
] as const;
describe('authored data-mark metadata', () => {
  for (const [mark, encoding] of cases)
    it(`${mark} retains its authored mark and description`, () => {
      const layout = compileChart(
        {
          mark,
          data,
          encoding: { ...encoding, description: { value: 'Exact & <authored> text' } },
          watermark: false,
        },
        options,
      );
      const marks = layout.marks.filter(
        (mark) => !mark.aria.decorative && (!Array.isArray(mark.data) || mark.data.length > 0),
      );
      expect(marks.length).toBeGreaterThan(0);
      for (const shape of marks) {
        expect(shape.markType).toBe(mark);
        expect(shape.authoredDescription).toBe('Exact & <authored> text');
        expect(shape.aria.label).toBe(shape.authoredDescription);
        expect(shape.identity).toBeDefined();
      }
      for (const shape of layout.marks.filter((mark) => mark.aria.decorative)) {
        expect(shape.markType).toBeUndefined();
        expect(shape.identity).toBeUndefined();
        expect(shape.authoredDescription).toBeUndefined();
      }
    });
  it('uses per-row descriptions for line dots and constant identities for the series', () => {
    const warnings: string[] = [];
    const layout = compileChart(
      {
        data: data.map((row, i) => ({ ...row, text: `row ${i}` })),
        mark: { type: 'line', point: true },
        encoding: { x: temporal, y: quantitative, color: nominal, description: { field: 'text' } },
      },
      { ...options, onWarn: (warning) => warnings.push(warning) },
    );
    const path = layout.marks.find((mark) => mark.type === 'line');
    expect(path?.authoredDescription).toBeUndefined();
    expect(path?.identity).toEqual({ category: 'A' });
    expect(
      warnings.some((warning) => warning.includes('description') && warning.includes('A')),
    ).toBe(true);
    expect(
      layout.marks.filter((mark) => mark.type === 'point').map((mark) => mark.authoredDescription),
    ).toEqual(['row 0', 'row 1']);
    expect(
      layout.marks.filter((mark) => mark.type === 'point').map((mark) => mark.markType),
    ).toEqual(['point', 'point']);
  });
  it('preserves string emptiness and formats numeric zero', () => {
    for (const [value, expected] of [
      [0, '0%'],
      ['', ''],
    ] as const) {
      const layout = compileChart(
        {
          data: [{ category: 'A', value: 1, text: value }],
          mark: 'bar',
          encoding: {
            x: quantitative,
            y: nominal,
            description: {
              field: 'text',
              ...(typeof value === 'number' ? { format: 'percent' } : {}),
            },
          },
        },
        options,
      );
      expect(layout.marks[0].authoredDescription).toBe(expected);
      expect(layout.marks[0].aria.label).toBe(expected);
    }
  });
  it('sanitizes identity suffixes and preserves date-only values', () => {
    const layout = compileChart(
      {
        data,
        mark: { type: 'line', point: true },
        encoding: { x: temporal, y: quantitative, color: nominal, key: { field: 'Mark ID' } },
      },
      options,
    );
    const dots = layout.marks.filter((mark) => mark.type === 'point');
    expect(dots[0].identity).toEqual({
      day: '2026-10-11',
      category: 'A',
      'field-mark-id': 'row-a',
    });
    expect(dots[0].authoredDescription).toBeUndefined();
  });
  it('preserves sugar provenance through nested layers and transform copies', () => {
    const layout = compileLayer(
      {
        data,
        layer: [
          {
            layer: [
              {
                mark: 'histogram',
                transform: [{ filter: { field: 'value', gt: 0 } }],
                encoding: { x: quantitative, description: { value: 'bins' } },
              },
            ],
          },
          { mark: 'density', encoding: { x: quantitative, description: { value: 'curve' } } },
        ],
      },
      options,
    );
    expect(
      new Set(layout.marks.filter((mark) => !mark.aria.decorative).map((mark) => mark.markType)),
    ).toEqual(new Set(['histogram', 'density']));
  });
});
