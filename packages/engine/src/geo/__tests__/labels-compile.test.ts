import { describe, expect, it } from 'vitest';
import { compileGeoMap } from '../compile-geo-map';
import { resolveGeoOverlay } from '../overlay-layout';

const topology = {
  type: 'Topology',
  objects: {
    regions: {
      type: 'GeometryCollection',
      geometries: [
        {
          type: 'Polygon',
          id: 'a',
          properties: { custom: 'Unjoined custom place', name: 'Never substitute' },
          arcs: [[0]],
        },
        { type: 'Polygon', id: 'b', properties: { name: 'Never infer' }, arcs: [[1]] },
      ],
    },
  },
  arcs: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [12, 0],
      [22, 0],
      [22, 10],
      [12, 10],
      [12, 0],
    ],
  ],
};
const base = {
  type: 'map' as const,
  geo: { features: topology, projection: 'identity' as const },
  data: [{ id: 'b', v: 1 }],
  encoding: {
    key: { field: 'id', type: 'nominal' as const },
    color: { field: 'v', type: 'quantitative' as const },
  },
  animation: false as const,
};
const options = { width: 600, height: 400 };
describe('opt-in map labels compilation', () => {
  it('keeps absent and empty opt-ins byte-equivalent and omits the labels bundle', () => {
    const baseline = compileGeoMap(base, options);
    expect(baseline.labels).toBeUndefined();
    expect(JSON.stringify(compileGeoMap({ ...base, callouts: [] }, options))).toBe(
      JSON.stringify(baseline),
    );
  });
  it('retains custom unjoined feature labels with projected interior geometry', () => {
    const layout = compileGeoMap(
      { ...base, encoding: { ...base.encoding, text: { field: 'custom', type: 'nominal' } } },
      options,
    );
    expect(layout.labels!.candidates.map((candidate) => candidate.text)).toEqual([
      'Unjoined custom place',
    ]);
    expect(layout.labels!.geometries[0].canonicalAnchor).toBeDefined();
    expect(layout.labels!.initialOverlay.inventory[0].text).toBe('Unjoined custom place');
  });
  it('reserves all authored callout notes once, independently of camera or visibility', () => {
    const callouts = [
      {
        id: 'missing',
        anchor: { kind: 'feature', id: 'unknown' },
        text: 'Exact authored explanation',
        subtitle: 'All supporting evidence',
      },
      {
        id: 'zoom',
        anchor: { kind: 'coordinate', space: 'source', x: 5, y: 5 },
        text: 'Visible later',
        minZoom: 3,
      },
    ];
    const baseline = compileGeoMap(base, options);
    const layout = compileGeoMap({ ...base, callouts }, options);
    expect(layout.area).toEqual(baseline.area);
    expect(layout.height).toBeGreaterThan(baseline.height);
    expect(layout.labels!.noteSlots).toHaveLength(2);
    const before = JSON.stringify(layout.labels!.noteSlots);
    resolveGeoOverlay(layout.labels!, { k: 4, tx: -50, ty: -20 });
    expect(JSON.stringify(layout.labels!.noteSlots)).toBe(before);
    expect(layout.labels!.initialOverlay.inventory.map((entry) => entry.text)).toEqual(
      callouts.map((callout) => callout.text),
    );
    expect(layout.labels!.initialOverlay.notes).toHaveLength(1);
    expect(
      layout.labels!.initialOverlay.inventory.find((entry) => entry.id === 'callout:zoom')
        ?.visibility,
    ).toBe('zoom-range');
  });
  it('subtracts measured note capacity before fitting an explicit fixed frame', () => {
    const callouts = [
      {
        id: 'note',
        anchor: { kind: 'coordinate', space: 'source', x: 5, y: 5 },
        text: 'Measured note capacity',
      },
    ];
    const baseline = compileGeoMap(base, { ...options, chromeLayout: 'subtract' });
    const layout = compileGeoMap({ ...base, callouts }, { ...options, chromeLayout: 'subtract' });
    expect(layout.area.height).toBeLessThan(baseline.area.height);
    expect(layout.height).toBe(baseline.height);
  });
  it('keeps every note and inventory record in a cramped map fallback', () => {
    const diagnostics: string[] = [];
    const callouts = [
      {
        id: 'note',
        anchor: { kind: 'feature', id: 'a' },
        text: 'An authored note that must never disappear',
        subtitle: 'Complete subtitle',
      },
    ];
    const layout = compileGeoMap(
      { ...base, callouts },
      {
        width: 120,
        height: 30,
        chromeLayout: 'subtract',
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic.code),
      },
    );
    expect(layout.labels!.noteSlots).toHaveLength(1);
    expect(layout.labels!.initialOverlay.inventory[0].text).toBe(callouts[0].text);
    expect(layout.labels!.initialOverlay.notes).toHaveLength(1);
    expect(diagnostics).toContain('MAP_LABEL_FRAME_UNFIT');
  });
});

it('binds point label anchors and radius without changing point geometry or paint order', () => {
  const points = {
    data: [
      { id: 'p', x: 5, y: 5, v: 100, label: 'Point label' },
      { id: 'q', x: 15, y: 5, v: 10, label: 'Smaller' },
    ],
    longitude: { field: 'x', type: 'quantitative' },
    latitude: { field: 'y', type: 'quantitative' },
    key: { field: 'id', type: 'nominal' },
    size: { field: 'v', type: 'quantitative' },
  };
  const baseline = compileGeoMap({ ...base, points }, options);
  const labeled = compileGeoMap(
    { ...base, points: { ...points, text: { field: 'label', type: 'nominal' } } },
    options,
  );
  expect(labeled.pointMarks).toEqual(baseline.pointMarks);
  const candidate = labeled.labels!.candidates.find((candidate) => candidate.id === 'point:p')!;
  const point = labeled.pointMarks.find((point) => point.key === 'p')!;
  expect(candidate.resolvedAnchor).toEqual({ x: point.cx, y: point.cy });
  expect(candidate.anchorRadius).toBe(point.r);
});

it('keeps a narrow map size key and labels clear of enabled zoom controls', () => {
  const points = {
    data: [
      { id: 'p', x: 5, y: 5, v: 100, label: 'Point label' },
      { id: 'q', x: 15, y: 5, v: 10, label: 'Smaller' },
    ],
    longitude: { field: 'x', type: 'quantitative' },
    latitude: { field: 'y', type: 'quantitative' },
    key: { field: 'id', type: 'nominal' },
    size: { field: 'v', type: 'quantitative' },
    text: { field: 'label', type: 'nominal' },
  };
  const layout = compileGeoMap(
    { ...base, geo: { ...base.geo, zoom: true }, points },
    { width: 390, height: 500 },
  );
  const controls = {
    x: layout.area.x + layout.area.width - 38,
    y: layout.area.y + 8,
    width: 30,
    height: 86,
  };
  const key = layout.pointSizeLegend!.bounds;
  const overlap =
    Math.max(
      0,
      Math.min(key.x + key.width, controls.x + controls.width) - Math.max(key.x, controls.x),
    ) *
    Math.max(
      0,
      Math.min(key.y + key.height, controls.y + controls.height) - Math.max(key.y, controls.y),
    );
  expect(overlap).toBe(0);
  expect(layout.labels!.obstacles).toContainEqual({
    ...controls,
    x: controls.x - layout.area.x,
    y: controls.y - layout.area.y,
  });
  const hidden = compileGeoMap(
    { ...base, geo: { ...base.geo, zoom: { controls: false } }, points },
    { width: 390, height: 500 },
  );
  expect(hidden.labels!.obstacles).not.toContainEqual({
    ...controls,
    x: controls.x - layout.area.x,
    y: controls.y - layout.area.y,
  });
  expect(hidden.pointMarks).toEqual(layout.pointMarks);
});

it('keeps feature callout text clear of other quantitative symbols without changing marks', () => {
  const points = {
    data: [
      { id: 'p', x: 5, y: 5, v: 100 },
      { id: 'q', x: 15, y: 5, v: 10 },
    ],
    longitude: { field: 'x', type: 'quantitative' },
    latitude: { field: 'y', type: 'quantitative' },
    key: { field: 'id', type: 'nominal' },
    size: { field: 'v', type: 'quantitative' },
  };
  const callouts = [
    {
      id: 'feature-note',
      anchor: { kind: 'feature', id: 'a' },
      text: 'Feature explanation',
      subtitle: 'Complete supporting evidence',
    },
  ];
  const baseline = compileGeoMap({ ...base, points }, options);
  const layout = compileGeoMap({ ...base, points, callouts }, options);
  expect(layout.pointMarks).toEqual(baseline.pointMarks);
  expect(layout.labels!.symbolObstacles).toEqual(
    layout.pointMarks.map((point) => ({ center: { x: point.cx, y: point.cy }, radius: point.r })),
  );
  for (const label of layout.labels!.initialOverlay.labels)
    for (const symbol of layout.labels!.symbolObstacles!) {
      const closestX = Math.max(
        label.bounds.x,
        Math.min(symbol.center.x, label.bounds.x + label.bounds.width),
      );
      const closestY = Math.max(
        label.bounds.y,
        Math.min(symbol.center.y, label.bounds.y + label.bounds.height),
      );
      expect(
        Math.hypot(closestX - symbol.center.x, closestY - symbol.center.y),
      ).toBeGreaterThanOrEqual(symbol.radius);
    }
});
