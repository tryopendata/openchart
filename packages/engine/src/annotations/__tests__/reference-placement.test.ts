import type { AnnotationAnchor, ChartSpec, RefLineAnnotation } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

const base: ChartSpec = {
  mark: 'point',
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
};
const anchors: AnnotationAnchor[] = ['top', 'bottom', 'left', 'right', 'auto'];
const compile = (annotations: RefLineAnnotation[], width = 640) =>
  compileChart({ ...base, annotations }, { width, height: 600, onWarn: () => {} });
describe('authored reference label placement', () => {
  it.each(anchors)('separates horizontal end from %s side', (labelAnchor) => {
    for (const placement of ['start', 'end'] as const) {
      const layout = compile([
        { type: 'refline', y: 5, label: 'Rule', labelAnchor, labelPlacement: placement },
      ]);
      const a = layout.annotations[0];
      expect(a.label!.x).toBeCloseTo(
        placement === 'start' ? layout.area.x + 4 : layout.area.x + layout.area.width - 4,
      );
      expect(a.label!.y - a.line!.start.y).toBe(labelAnchor === 'bottom' ? 14 : -4);
      expect(a.label!.style.textAnchor).toBe(placement === 'start' ? 'start' : 'end');
    }
  });
  it.each(anchors)('separates vertical end from %s side', (labelAnchor) => {
    for (const placement of ['start', 'end'] as const) {
      const layout = compile([
        { type: 'refline', x: 5, label: 'Rule', labelAnchor, labelPlacement: placement },
      ]);
      const a = layout.annotations[0];
      expect(a.label!.y).toBeCloseTo(
        placement === 'start' ? layout.area.y + 14 : layout.area.y + layout.area.height - 4,
      );
      expect(a.label!.x - a.line!.start.x).toBe(labelAnchor === 'right' ? -4 : 4);
    }
  });
  it('reserves and wraps outside labels with deterministic lanes', () => {
    const plain = compile([]);
    const annotations: RefLineAnnotation[] = [
      {
        type: 'refline',
        id: 'a',
        y: 5,
        label: 'A very long outside horizontal label that needs wrapping',
        labelPlacement: 'outside',
      },
      {
        type: 'refline',
        id: 'b',
        y: 5.1,
        label: 'A second label at almost the same value',
        labelPlacement: 'outside',
      },
      {
        type: 'refline',
        id: 'c',
        x: 5,
        label: 'An event above the plot',
        labelPlacement: 'outside',
      },
    ];
    const layout = compile(annotations);
    expect(layout.area.width).toBeLessThan(plain.area.width);
    expect(layout.area.y).toBeGreaterThan(plain.area.y);
    const [a, b, c] = layout.annotations;
    expect(a.bounds!.x).toBeGreaterThan(layout.area.x + layout.area.width);
    expect(a.label!.lines!.length).toBeGreaterThan(1);
    expect(b.bounds!.y).toBeGreaterThanOrEqual(a.bounds!.y + a.bounds!.height);
    expect(c.bounds!.y + c.bounds!.height).toBeLessThan(layout.area.y);
    for (const item of [a, b, c]) {
      expect(item.bounds!.x).toBeGreaterThanOrEqual(0);
      expect(item.bounds!.x + item.bounds!.width).toBeLessThanOrEqual(640);
      expect(item.label!.connector).toBeDefined();
    }
  });
  it('keeps authored offsets pinned and reports overflow', () => {
    const warnings: string[] = [];
    const result = compileChart(
      {
        ...base,
        annotations: [
          {
            type: 'refline',
            y: 5,
            label: 'Pinned',
            labelPlacement: 'auto',
            labelOffset: { dx: 2000 },
          },
        ],
      },
      { width: 640, height: 600, onWarn: (w) => warnings.push(w) },
    );
    expect(result.annotations[0].label!.x).toBeGreaterThan(640);
    expect(warnings.some((w) => w.includes('labelOffset') && w.includes('overflow'))).toBe(true);
  });
});

it('keeps crowded outside labels inside the figure even near the bottom rule', () => {
  const result = compile(
    [0.1, 0.2, 0.3, 0.4].map((y) => ({
      type: 'refline',
      y,
      label: 'A wrapped reference description near the lower edge',
      labelPlacement: 'outside',
    })),
    390,
  );
  for (const a of result.annotations)
    expect(a.bounds!.y + a.bounds!.height).toBeLessThanOrEqual(592);
  for (let i = 1; i < result.annotations.length; i++)
    expect(result.annotations[i].bounds!.y).toBeGreaterThanOrEqual(
      result.annotations[i - 1].bounds!.y + result.annotations[i - 1].bounds!.height,
    );
});

it('auto avoids both occupied ends by sliding while retaining the authored side', async () => {
  const { placeReferenceLabel } = await import('../reference-layout');
  const { heuristicMeasure } = await import('../geometry');
  const result = compile([
    { type: 'refline', y: 5, label: 'Rule', labelAnchor: 'bottom', labelPlacement: 'end' },
  ]);
  const a = result.annotations[0];
  const originalY = a.label!.y;
  placeReferenceLabel(
    { type: 'refline', y: 5, labelPlacement: 'auto' },
    a,
    result.area,
    { x: 0, y: 0, width: 640, height: 600 },
    { top: 0, right: 0, labelWidth: 160 },
    {},
    heuristicMeasure,
    result.theme.colors,
    undefined,
    [
      { kind: 'legend', x: 0, y: originalY - 20, width: 160, height: 40 },
      { kind: 'endpoint-label', x: 450, y: originalY - 20, width: 190, height: 40 },
    ],
  );
  expect(a.label!.y).toBe(originalY);
  expect(a.bounds!.x).toBeGreaterThanOrEqual(160);
  expect(a.bounds!.x + a.bounds!.width).toBeLessThanOrEqual(450);
  expect(a.label!.connector).toBeDefined();
});

it('keeps outside references beyond dual-axis endpoints and the right legend', async () => {
  const { compileLayer } = await import('../../compile');
  const leaf: ChartSpec = {
    ...base,
    mark: 'line',
    data: ['North', 'South'].flatMap((s, i) => [
      { x: 0, y: i + 1, s },
      { x: 10, y: i + 5, s },
    ]),
    encoding: {
      ...base.encoding,
      x: { field: 'x', type: 'ordinal' },
      color: { field: 's', type: 'nominal' },
    },
  };
  const result = compileLayer(
    {
      layer: [leaf, leaf],
      resolve: { scale: { y: 'independent' } },
      legend: { position: 'right' },
      endpointLabels: { content: 'label' },
      annotations: [
        { type: 'refline', y: 6.5, label: 'Outside reference', labelPlacement: 'outside' },
      ],
    },
    { width: 1000, height: 500 },
  );
  const box = result.annotations[0].bounds!;
  expect(box.x).toBeGreaterThanOrEqual(
    result.endpointLabels!.bounds.x + result.endpointLabels!.bounds.width,
  );
  expect(box.x).toBeGreaterThanOrEqual(result.legend.bounds.x + result.legend.bounds.width);
});

it.each([
  320, 390, 768, 1280,
])('keeps facet reference labels and leaders in their own cell at %s', (width) => {
  for (const mode of ['shared', 'independent'] as const) {
    const result = compileChart(
      {
        ...base,
        chromeLayout: 'grow',
        chrome: { title: 'Facet title', subtitle: 'Supporting subtitle' },
        data: ['A', 'B', 'C', 'D'].flatMap((group) => base.data.map((row) => ({ ...row, group }))),
        encoding: { ...base.encoding, facet: { field: 'group', type: 'nominal', columns: 2 } },
        resolve: { scale: { y: mode } },
        annotations: [
          { type: 'refline', y: 6.5, label: 'Outside reference', labelPlacement: 'outside' },
          { type: 'refline', x: 5, label: 'Event', labelPlacement: 'outside' },
        ],
      },
      { width, height: 400 },
    );
    expect(result.chrome.grownHeight).toBeCloseTo(result.dimensions.height - 400);
    for (const panel of result.facet!.panels) {
      for (const tick of panel.axes.x?.ticks ?? []) {
        expect(tick.labelPosition ?? tick.position).toBeGreaterThanOrEqual(panel.area.x - 1);
        expect(tick.labelPosition ?? tick.position).toBeLessThanOrEqual(
          panel.area.x + panel.area.width,
        );
      }
      const [horizontal, vertical] = panel.annotations;
      expect(horizontal.bounds!.x).toBeGreaterThan(panel.area.x + panel.area.width);
      expect(vertical.bounds!.y + vertical.bounds!.height).toBeLessThan(panel.area.y);
      expect(vertical.bounds!.y).toBeGreaterThan(panel.header.y);
      for (const annotation of panel.annotations) {
        const b = annotation.bounds!;
        expect(b.x).toBeGreaterThanOrEqual(panel.area.x);
        expect(b.y + b.height).toBeLessThanOrEqual(panel.area.y + panel.area.height);
        for (const other of result.facet!.panels.filter((p) => p !== panel)) {
          if (other.area.x > panel.area.x && other.area.y === panel.area.y) {
            expect(b.x + b.width).toBeLessThan(other.area.x);
            // Both endpoints stay on the owning side of the next panel.
            expect(annotation.label!.connector!.from.x).toBeLessThan(other.area.x);
            expect(annotation.label!.connector!.to.x).toBeLessThan(other.area.x);
          }
          if (other.area.y < panel.area.y) {
            expect(b.y).toBeGreaterThan(other.area.y + other.area.height);
            expect(annotation.label!.connector!.from.y).toBeGreaterThan(
              other.area.y + other.area.height,
            );
            expect(annotation.label!.connector!.to.y).toBeGreaterThan(
              other.area.y + other.area.height,
            );
          }
        }
      }
    }
  }
});

it('keeps the outside gutter above notes, footer and watermark', () => {
  const result = compileChart(
    {
      ...base,
      chrome: { title: 'References', source: 'Source', footer: 'Footer' },
      annotations: [0.1, 0.2, 0.3, 0.4].map((y) => ({
        type: 'refline',
        y,
        label: 'A wrapped reference description near the lower edge',
        labelPlacement: 'outside',
      })),
    },
    { width: 390, height: 600 },
  );
  for (const a of result.annotations) {
    expect(a.bounds!.y).toBeGreaterThanOrEqual(result.area.y);
    expect(a.bounds!.y + a.bounds!.height).toBeLessThanOrEqual(
      result.area.y + result.area.height + 0.001,
    );
  }
});

it.each([
  390, 1280,
])('keeps crowded reference leaders clear of neighboring labels at %s', async (width) => {
  const { interpolateAnnotationGeometry } = await import('../interpolate');
  for (const reverse of [false, true])
    for (const y of [0.1, 5]) {
      const annotations: RefLineAnnotation[] = [
        {
          type: 'refline',
          id: 'long',
          y,
          label: 'A longer threshold label, wrapped in the reserved right gutter',
          labelPlacement: 'outside',
        },
        {
          type: 'refline',
          id: 'short',
          y: y + 0.2,
          label: 'A nearby threshold',
          labelPlacement: 'outside',
        },
      ];
      if (reverse) annotations.reverse();
      const before = compile(annotations, width);
      const after = compile(
        annotations.map((a) => ({ ...a, y: Number(a.y) + 0.5 })),
        width,
      );
      for (const t of [0, 0.5, 1]) {
        const items = after.annotations.map((a, i) =>
          interpolateAnnotationGeometry(before.annotations[i], a, t),
        );
        for (const a of items) {
          const connector = a.label!.connector!;
          expect(connector).toBeDefined();
          for (const b of items) {
            // A straight leader's convex hull must remain in the gutter corridor,
            // including when a neighboring label is taller or a bottom sweep moves it.
            expect(Math.max(connector.from.x, connector.to.x)).toBeLessThan(b.bounds!.x - 2);
          }
          expect(
            Math.hypot(
              connector.to.x - connector.endpoint!.x,
              connector.to.y - connector.endpoint!.y,
            ),
          ).toBeCloseTo(4);
        }
      }
    }
});
