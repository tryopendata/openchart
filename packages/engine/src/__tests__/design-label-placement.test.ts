import type { ChartSpec, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

const bars: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'Alpha', value: 100 },
    { name: 'Beta', value: -25 },
    { name: 'Gamma', value: 0 },
  ],
  encoding: { x: { field: 'value', type: 'quantitative' }, y: { field: 'name', type: 'nominal' } },
  labels: { density: 'all' },
};
describe('authored value placement through the shared frame', () => {
  it('omission preserves adaptive layout', () => {
    const a = compileChart(bars, { width: 680, height: 400 });
    const b = compileChart(
      { ...bars, labels: { density: 'all', placement: 'adaptive' } },
      { width: 680, height: 400 },
    );
    expect(b.area).toEqual(a.area);
    expect(b.marks).toEqual(a.marks);
  });
  it('reserves a measured column and aligns signed values outside the plot', () => {
    const base = compileChart(bars, { width: 680, height: 400 });
    const layout = compileChart(
      { ...bars, labels: { density: 'all', placement: 'column' } },
      { width: 680, height: 400 },
    );
    expect(layout.area.width).toBeLessThan(base.area.width);
    const rects = layout.marks.filter((m): m is RectMark => m.type === 'rect');
    expect(rects).toHaveLength(3);
    const labels = rects.flatMap((mark) => (mark.label ? [mark.label] : []));
    expect(labels).toHaveLength(3);
    expect(new Set(labels.map((m) => m.x)).size).toBe(1);
    expect(labels[0].x).toBeGreaterThan(layout.area.x + layout.area.width);
  });
  it.each([
    'circle',
    'range',
    'arc',
  ] as const)('rejects placement on %s at the authored path', (mark) => {
    expect(() =>
      compileChart(
        {
          ...bars,
          mark,
          encoding:
            mark === 'arc'
              ? {
                  theta: { field: 'value', type: 'quantitative' },
                  color: { field: 'name', type: 'nominal' },
                }
              : mark === 'range'
                ? { ...bars.encoding, x2: { field: 'value', type: 'quantitative' } }
                : bars.encoding,
          labels: { placement: 'inside' },
        } as ChartSpec,
        { width: 680, height: 400 },
      ),
    ).toThrow('/labels/placement');
  });
  it('rejects a value column on grouped bars', () => {
    expect(() =>
      compileChart(
        {
          ...bars,
          data: [...bars.data, { name: 'Alpha', value: 20 }],
          encoding: { ...bars.encoding, color: { field: 'name', type: 'nominal' } },
          labels: { placement: 'column' },
        },
        { width: 680, height: 400 },
      ),
    ).toThrow('/labels/placement');
  });
  it('rejects stacked-band options on a line', () => {
    expect(() =>
      compileChart(
        {
          mark: 'line',
          data: [{ x: 'a', y: 1 }],
          encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
          endpointLabels: { anchor: 'band' },
        },
        { width: 680, height: 400 },
      ),
    ).toThrow('/endpointLabels/anchor');
  });
});

for (const width of [330, 390, 680]) {
  it(`outside negative columns keep their value lane above the x axis at ${width}px`, () => {
    const layout = compileChart(
      {
        mark: 'bar',
        data: [
          { name: 'negative', value: -20 },
          { name: 'positive', value: 30 },
        ],
        encoding: {
          x: { field: 'name', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
        labels: { placement: 'outside', density: 'all', format: '.1f' },
      },
      { width, height: 400 },
    );
    const rects = layout.marks.filter((mark): mark is RectMark => mark.type === 'rect');
    const negative = rects.find((mark) => mark.data.value === -20)!;
    expect(negative.label?.visible).toBe(true);
    expect(negative.label!.y).toBeGreaterThan(negative.y + negative.height);
    expect(negative.label!.y).toBeLessThan(layout.axes.x!.start.y);
    expect(layout.axes.x!.start.y).toBeGreaterThan(layout.area.y + layout.area.height);
  });
}
it('facets reserve equally sized value columns from the complete figure values', () => {
  const spec: ChartSpec = {
    ...bars,
    data: [
      { name: 'Alpha', value: 1, region: 'A' },
      { name: 'Beta', value: 10000, region: 'B' },
    ],
    encoding: { ...bars.encoding, row: { field: 'region', type: 'nominal' } },
    labels: { placement: 'column', density: 'all', format: '.1f' },
  };
  const layout = compileChart(spec, { width: 680, height: 600 });
  const panels = layout.facet!.panels;
  expect(panels).toHaveLength(2);
  const labels = panels.map((panel) => {
    const mark = panel.marks.find((mark): mark is RectMark => mark.type === 'rect')!;
    return mark.label!;
  });
  expect(labels[0].x).toBe(labels[1].x);
  expect(panels[0].area.width).toBe(panels[1].area.width);
  for (let i = 0; i < panels.length; i++)
    expect(labels[i].x).toBeGreaterThan(panels[i].area.x + panels[i].area.width);
});
it('faceted fallback chooses one mode and reports its authored path', () => {
  const diagnostics: import('@opendata-ai/openchart-core').DesignDiagnostic[] = [];
  const layout = compileChart(
    {
      ...bars,
      data: [
        { name: 'A', value: 1, region: 'A' },
        { name: 'B', value: 2, region: 'B' },
      ],
      encoding: { ...bars.encoding, row: { field: 'region', type: 'nominal' } },
      labels: { placement: 'column', format: '.20f' },
    },
    { width: 180, height: 500, onDiagnostic: (d) => diagnostics.push(d) },
  );
  expect(
    diagnostics.some(
      (d) => d.path === '/labels/placement' && d.code.startsWith('layout.value-labels.'),
    ),
  ).toBe(true);
  expect(
    layout.facet!.panels.every((panel) =>
      panel.marks.every((mark) => mark.type !== 'rect' || !mark.label),
    ),
  ).toBe(true);
});

it('faceted headers reserve a lane per panel together with a value column', () => {
  const spec: ChartSpec = {
    ...bars,
    data: [
      { name: 'A', value: 1, region: 'A' },
      { name: 'B', value: 10000, region: 'B' },
    ],
    encoding: {
      ...bars.encoding,
      y: {
        field: 'name',
        type: 'nominal',
        axis: { title: 'Department header', titleAngle: 0, titleAnchor: 'end' },
      },
      row: { field: 'region', type: 'nominal' },
    },
    labels: { placement: 'column', density: 'all', format: '.1f' },
  };
  const layout = compileChart(spec, { width: 390, height: 600 });
  for (const panel of layout.facet!.panels) {
    expect(panel.axes.y?.titlePosition?.y).toBeLessThan(panel.area.y);
    expect(panel.axes.y?.titlePosition?.y).toBeGreaterThan(panel.header.y);
    const label = panel.marks.find((mark): mark is RectMark => mark.type === 'rect')!.label!;
    expect(label.x).toBeGreaterThan(panel.area.x + panel.area.width);
    expect(label.x).toBeLessThan(layout.dimensions.width);
  }
});

it.each([680, 1024])('wrapped facet value columns stay within their own cells at %ipx', (width) => {
  const layout = compileChart(
    {
      ...bars,
      data: ['A', 'B', 'C', 'D'].flatMap((region, i) => [
        { name: 'First', value: (i + 1) * 1234.5, region },
        { name: 'Second', value: -12.5, region },
      ]),
      encoding: { ...bars.encoding, facet: { field: 'region', type: 'nominal', columns: 2 } },
      labels: { placement: 'column', density: 'all', format: ',.1f' },
    },
    { width, height: 700 },
  );
  const panels = layout.facet!.panels;
  for (const panel of panels) {
    const labels = panel.marks.flatMap((mark) =>
      mark.type === 'rect' && mark.label ? [mark.label] : [],
    );
    expect(new Set(labels.map((label) => label.x)).size).toBe(1);
    const rightNeighbor = panels.find(
      (other) => Math.abs(other.area.y - panel.area.y) < 1 && other.area.x > panel.area.x,
    );
    for (const label of labels) {
      expect(label.x).toBeGreaterThan(panel.area.x + panel.area.width);
      expect(label.x).toBeLessThan(rightNeighbor?.area.x ?? width);
    }
  }
});

it('allows category-colored simple bars in a value column', () => {
  const layout = compileChart(
    {
      ...bars,
      encoding: { ...bars.encoding, color: { field: 'name', type: 'nominal' } },
      labels: { placement: 'column' },
    },
    { width: 640, height: 400 },
  );
  expect(layout.marks.filter((m) => m.type === 'rect')).toHaveLength(3);
});

it('accepts an inferred nominal category for a simple value column', () => {
  const layout = compileChart(
    {
      ...bars,
      encoding: { x: { field: 'value' }, y: { field: 'name' } },
      labels: { placement: 'column' },
    },
    { width: 680, height: 400 },
  );
  expect(layout.marks.filter((mark) => mark.type === 'rect').every((mark) => !!mark.label)).toBe(
    true,
  );
});

it('validates value-column cardinality after one aggregate transform', () => {
  const layout = compileChart(
    {
      mark: 'bar',
      data: [
        { name: 'A', value: 10 },
        { name: 'A', value: 20 },
        { name: 'B', value: 3 },
      ],
      transform: [{ aggregate: [{ op: 'sum', field: 'value', as: 'total' }], groupby: ['name'] }],
      encoding: {
        x: { field: 'total', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
      },
      labels: { placement: 'column', density: 'all' },
    },
    { width: 680, height: 400 },
  );
  const rects = layout.marks.filter((mark): mark is RectMark => mark.type === 'rect');
  expect(rects).toHaveLength(2);
  expect(rects.map((mark) => mark.data.total)).toEqual([30, 3]);
  expect(new Set(rects.map((mark) => mark.label?.x)).size).toBe(1);
});

it('still rejects genuinely grouped values after preparation at the authored placement path', () => {
  expect(() =>
    compileChart(
      {
        ...bars,
        data: [
          { name: 'A', value: 1, series: 'One' },
          { name: 'A', value: 2, series: 'Two' },
        ],
        encoding: { ...bars.encoding, color: { field: 'series', type: 'nominal' } },
        labels: { placement: 'column' },
      },
      { width: 680, height: 400 },
    ),
  ).toThrow('/labels/placement');
});
