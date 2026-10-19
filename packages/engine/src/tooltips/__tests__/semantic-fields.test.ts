import { expect, it } from 'vitest';
import { compileChart, compileLayer } from '../../compile';
import { sharedTooltipFields } from '../metadata';

const source = {
  mark: 'line',
  data: [
    { x: 'same', y: 5, s: '5', extra: 'same' },
    { x: 'next', y: 7, s: 'other', extra: 'same' },
  ],
  encoding: {
    x: { field: 'x', type: 'ordinal' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 's', type: 'nominal' },
    tooltip: [
      { field: 'extra', title: 'same' },
      { field: 'y', type: 'quantitative', title: 'same', format: '.0f' },
      { field: 'x', title: 'same' },
      { field: 's', title: 'same' },
      { field: 'y', type: 'quantitative', title: 'again', format: '.1f' },
    ],
  },
};
it('tags explicit fields semantically without changing order or guessing equal display strings', () => {
  const layout = compileChart(source as never, { width: 800, height: 500 });
  const line = layout.marks.find((m) => m.type === 'line')!;
  if (line.type !== 'line') throw Error();
  const tip = line.dataPoints![0].tooltip!;
  expect(tip.fields.map((f) => f.source?.field)).toEqual(['extra', 'y', 'x', 's', 'y']);
  expect(tip.fields.map((f) => f.role)).toEqual([undefined, 'value', 'x', 'series', 'value']);
  expect(sharedTooltipFields(tip).map((f) => f.value)).toEqual(['same', '5', '5.0']);
});
it('tags default value fields and preserves layer scope through compilation', () => {
  const { tooltip: _, ...encoding } = source.encoding;
  const layout = compileLayer(
    {
      layer: [
        { ...source, encoding },
        { ...source, encoding },
      ],
    } as never,
    { width: 800, height: 500 },
  );
  const lines = layout.marks.filter((m) => m.type === 'line');
  expect(lines).toHaveLength(4);
  for (const mark of lines) {
    const field = mark.dataPoints![0].tooltip!.fields.find((f) => f.role === 'value')!;
    expect(field.source?.field).toBe('y');
    expect(field.source?.layer).toMatch(/^layer:\d+$/);
  }
});
it('tags default area values and facet descriptor panel scope', () => {
  const { tooltip: _, ...encoding } = source.encoding;
  const area = compileChart({ ...source, mark: 'area', encoding } as never, {
    width: 800,
    height: 500,
  });
  expect(
    area.marks
      .find((m) => m.type === 'area')!
      .dataPoints![0].tooltip!.fields.some((f) => f.role === 'value' && f.source?.field === 'y'),
  ).toBe(true);
  const facet = compileChart(
    {
      mark: 'point',
      data: [
        { x: 1, y: 2, p: 'a' },
        { x: 2, y: 3, p: 'b' },
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        facet: { field: 'p', type: 'nominal' },
      },
    } as never,
    { width: 800, height: 500 },
  );
  expect(
    [...facet.tooltipDescriptors.values()]
      .map((t) => t.fields.find((f) => f.source?.field === 'y')!.source!.panel)
      .sort(),
  ).toEqual(['facet:a', 'facet:b']);
});

it('retains the actual source channel when x and y share a field', () => {
  const layout = compileChart(
    {
      mark: 'point',
      data: [{ n: 2 }],
      encoding: {
        x: { field: 'n', type: 'quantitative' },
        y: { field: 'n', type: 'quantitative' },
      },
    },
    { width: 400, height: 300 },
  );
  const fields = [...layout.tooltipDescriptors.values()][0].fields;
  expect(fields.map((field) => field.source?.channel)).toEqual(['y', 'x']);
});
