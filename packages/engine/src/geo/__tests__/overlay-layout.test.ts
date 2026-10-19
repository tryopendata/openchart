import type { GeoLabelCandidate, GeoLabelsInput } from '@opendata-ai/openchart-core';
import { geoIdentity } from 'd3-geo';
import { expect, it } from 'vitest';
import { captureGeoLabelGeometry } from '../label-geometry';
import { resolveGeoOverlay } from '../overlay-layout';

const block = {
  width: 18,
  height: 10,
  lines: [
    {
      text: 'Place',
      x: 0,
      y: 8,
      style: {
        fontFamily: 'sans-serif',
        fontSize: 10,
        fontWeight: 400,
        fill: '#111',
        lineHeight: 1,
      },
    },
  ],
};
const candidate = (id: string, x = 50, y = 50): GeoLabelCandidate => ({
  id,
  kind: 'text',
  anchor: { kind: 'point', id },
  text: `Custom ${id}`,
  priority: 0,
  block,
  resolvedAnchor: { x, y },
});
const input = (candidates: GeoLabelCandidate[]): GeoLabelsInput => ({
  candidates,
  geometries: [],
  viewport: { x: 0, y: 0, width: 100, height: 100 },
  obstacles: [],
  noteSlots: [],
});
it('keeps complete fallback notes when a key or symbol covers their numbered anchor', () => {
  const c = {
    ...candidate('note'),
    kind: 'callout' as const,
    noteSlot: 0,
    block: { ...block, width: 500 },
  };
  const source = input([c]);
  source.noteSlots = [
    { id: 'note', number: 1, block, bounds: { x: 0, y: 110, width: 80, height: 20 } },
  ];
  expect(resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 }).markers).toHaveLength(1);
  for (const obstacle of [
    { obstacles: [{ x: 40, y: 40, width: 20, height: 20 }] },
    { symbolObstacles: [{ center: { x: 50, y: 50 }, radius: 15 }] },
  ]) {
    const result = resolveGeoOverlay({ ...source, ...obstacle }, { k: 1, tx: 0, ty: 0 });
    expect(result.notes).toHaveLength(1);
    expect(result.markers).toHaveLength(0);
    expect(result.inventory[0].text).toBe('Custom note');
  }
});
it('uses the largest visible multipart component and changes it after camera clipping', () => {
  const source = input([
    {
      ...candidate('feature'),
      anchor: { kind: 'feature', id: 'F' },
      geometryId: 'F',
      resolvedAnchor: undefined,
    },
  ]);
  source.geometries = [
    {
      featureId: 'F',
      bounds: { x: 0, y: 0, width: 300, height: 100 },
      canonicalAnchor: { x: 40, y: 40 },
      vertexCount: 8,
      mode: 'retained',
      components: [
        {
          index: 0,
          exterior: [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 80, y: 80 },
            { x: 0, y: 80 },
          ],
          holes: [],
        },
        {
          index: 1,
          exterior: [
            { x: 220, y: 0 },
            { x: 280, y: 0 },
            { x: 280, y: 60 },
            { x: 220, y: 60 },
          ],
          holes: [],
        },
      ],
    },
  ];
  const before = structuredClone(source);
  const first = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(first.labels[0].anchor.x).toBeLessThan(100);
  const second = resolveGeoOverlay(source, { k: 1, tx: -200, ty: 0 });
  expect(second.labels[0].anchor.x).toBeGreaterThanOrEqual(20);
  expect(resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 })).toEqual(first);
  expect(source).toEqual(before);
});
it('retains every custom name beyond200, prioritizes IDs deterministically and exposes all reasons', () => {
  const source = input(Array.from({ length: 201 }, (_, i) => candidate(String(i))));
  source.candidates.push(
    { ...candidate('zoom'), minZoom: 2 },
    { ...candidate('off', 200, 200) },
    { ...candidate('unresolved'), resolvedAnchor: undefined },
  );
  source.candidates[0].priority = 10;
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(result.inventory).toHaveLength(204);
  expect(result.inventory.find((e) => e.id === 'zoom')!.visibility).toBe('zoom-range');
  expect(result.inventory.filter((e) => e.limitation === 'candidate-limit').length).toBeGreaterThan(
    0,
  );
  expect(result.labels[0].id).toBe('0');
  expect(result.inventory.every((e) => e.text.startsWith('Custom '))).toBe(true);
});
it('retains fallback limitation and only shows canonical fallback while insideviewport', () => {
  const source = input([{ ...candidate('f'), geometryId: 'f' }]);
  source.geometries = [
    {
      featureId: 'f',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      canonicalAnchor: { x: 50, y: 50 },
      vertexCount: 0,
      mode: 'fallback',
    },
  ];
  const visible = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(visible.inventory[0]).toMatchObject({ visibility: 'visible', limitation: 'vertex-limit' });
  expect(resolveGeoOverlay(source, { k: 1, tx: 100, ty: 0 }).inventory[0].visibility).toBe(
    'offscreen',
  );
});
it('moves the full callout to its fixed note slot and leaves camera-dependent reservations unchanged', () => {
  const c = {
    ...candidate('callout'),
    kind: 'callout' as const,
    subtitle: 'Full explanation',
    noteSlot: 0,
  };
  const source = input([c]);
  source.obstacles = [source.viewport];
  source.noteSlots = [
    {
      id: 'callout',
      number: 1,
      bounds: { x: 0, y: 110, width: 100, height: 40 },
      block: { ...block, height: 40 },
    },
  ];
  const before = structuredClone(source);
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(result.notes).toEqual([{ id: 'callout', slot: source.noteSlots[0] }]);
  expect(result.inventory[0]).toMatchObject({
    visibility: 'collision',
    presentation: 'note',
    subtitle: 'Full explanation',
  });
  // The whole map is obstructed, so the note survives without a covered marker.
  expect(result.markers).toHaveLength(0);
  expect(source).toEqual(before);
});
it('gives unresolved and offscreen their own reasons without inventing anchors', () => {
  const result = resolveGeoOverlay(
    input([{ ...candidate('missing'), resolvedAnchor: undefined }, candidate('outside', 120, 50)]),
    { k: 1, tx: 0, ty: 0 },
  );
  expect(result.labels).toEqual([]);
  expect(result.inventory.map((e) => e.visibility)).toEqual(['unresolved', 'offscreen']);
});
it('keeps every overflow callout in fixed notes beyond the separate bounded visualworklimit', () => {
  const source = input(
    Array.from({ length: 130 }, (_, i) => ({
      ...candidate(String(i)),
      kind: 'callout' as const,
      noteSlot: i,
    })),
  );
  source.noteSlots = source.candidates.map((c, i) => ({
    id: c.id,
    number: i + 1,
    bounds: { x: 0, y: 110 + i * 12, width: 100, height: 12 },
    block,
  }));
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  for (const entry of result.inventory.filter((e) => e.limitation === 'candidate-limit'))
    expect(result.notes.some((n) => n.id === entry.id)).toBe(true);
  expect(result.inventory).toHaveLength(130);
});

it('keeps a point name clear of its true quantitative circle without changing its radius or center', () => {
  const point = { ...candidate('bubble'), anchorRadius: 18 };
  const source = input([point]);
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(result.labels).toHaveLength(1);
  const b = result.labels[0].bounds;
  const nearest = {
    x: Math.max(b.x, Math.min(50, b.x + b.width)),
    y: Math.max(b.y, Math.min(50, b.y + b.height)),
  };
  expect(Math.hypot(nearest.x - 50, nearest.y - 50)).toBeGreaterThan(18);
  expect(point.resolvedAnchor).toEqual({ x: 50, y: 50 });
  expect(point.anchorRadius).toBe(18);
});

it('keeps the priority cap fixed when early callouts are hidden at this zoom', () => {
  const source = input(
    Array.from({ length: 129 }, (_, i) => ({
      ...candidate(String(i).padStart(3, '0')),
      kind: 'callout' as const,
      minZoom: i < 128 ? 2 : undefined,
      noteSlot: i,
    })),
  );
  source.noteSlots = source.candidates.map((c, i) => ({
    id: c.id,
    number: i + 1,
    bounds: { x: 0, y: 110 + i * 12, width: 100, height: 12 },
    block,
  }));
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(result.labels).toEqual([]);
  expect(result.inventory[128]).toMatchObject({
    visibility: 'geometry-budget',
    limitation: 'candidate-limit',
    presentation: 'note',
  });
  expect(result.notes[0].id).toBe('128');
});
it('reports missing fixed note capacity explicitly while retaining complete callout text', () => {
  const source = input([{ ...candidate('missing-note'), kind: 'callout', noteSlot: 0 }]);
  source.obstacles = [source.viewport];
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(result.inventory[0].text).toBe('Custom missing-note');
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'GEO_CALLOUT_NOTE_CAPACITY', severity: 'error' }),
    ]),
  );
});
it('reports search work limits separately from geometry budgets', () => {
  const source = input([{ ...candidate('f'), geometryId: 'f' }]);
  source.geometries = [
    {
      featureId: 'f',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      canonicalAnchor: { x: 50, y: 50 },
      mode: 'retained',
      vertexCount: 4,
      searchLimited: true,
      components: [
        {
          index: 0,
          exterior: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          holes: [],
        },
      ],
    },
  ];
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(result.inventory[0]).toMatchObject({ visibility: 'visible', limitation: 'search-limit' });
  expect(result.diagnostics![0].code).toBe('GEO_LABEL_SEARCH_LIMIT');
});

it('places equally ranked identities identically after source data order changes', () => {
  const a = candidate('A', 50, 50),
    b = candidate('B', 50, 50),
    c = candidate('C', 50, 50);
  expect(resolveGeoOverlay(input([a, b, c]), { k: 1, tx: 0, ty: 0 }).labels).toEqual(
    resolveGeoOverlay(input([c, b, a]), { k: 1, tx: 0, ty: 0 }).labels,
  );
});

it('keeps feature and coordinate callouts clear of neighboring quantitative symbols at settle zoom', () => {
  for (const anchor of [
    { kind: 'feature' as const, id: 'Texas' },
    { kind: 'coordinate' as const, space: 'source' as const, x: 50, y: 50 },
  ]) {
    const c = {
      ...candidate('Texas'),
      kind: 'callout' as const,
      anchor,
      noteSlot: 0,
      subtitle: 'Complete Houston explanation',
    };
    const source = input([c]);
    source.symbolObstacles = [{ center: { x: 50, y: 50 }, radius: 35 }];
    source.noteSlots = [
      {
        id: 'Texas',
        number: 1,
        bounds: { x: 0, y: 110, width: 100, height: 40 },
        block: { ...block, height: 40 },
      },
    ];
    const before = structuredClone(source);
    const blocked = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
    expect(blocked.labels).toEqual([]);
    expect(blocked.notes[0].slot).toEqual(source.noteSlots[0]);
    expect(blocked.inventory[0].subtitle).toBe('Complete Houston explanation');
    // Center transforms but the displayed bubble radius remains35 CSSpx.
    const moved = resolveGeoOverlay(source, { k: 2, tx: -50, ty: -50 });
    expect(moved.labels).toEqual([]);
    expect(moved.notes).toEqual(blocked.notes);
    expect(source).toEqual(before);
  }
});
it('can choose a clear neighboring position while honoring constant screen symbol radii', () => {
  const source = input([{ ...candidate('label'), kind: 'callout' as const }]);
  source.symbolObstacles = [{ center: { x: 62, y: 50 }, radius: 12 }];
  const result = resolveGeoOverlay(source, { k: 1, tx: 0, ty: 0 });
  expect(result.labels).toHaveLength(1);
  const b = result.labels[0].bounds;
  const dx = Math.max(b.x, Math.min(62, b.x + b.width)) - 62,
    dy = Math.max(b.y, Math.min(50, b.y + b.height)) - 50;
  expect(Math.hypot(dx, dy)).toBeGreaterThan(14);
});

it('proves actual nonzero fill again after zoom exposes only a cancelled nested region', () => {
  const outer = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
    inner = [
      [25, 25],
      [25, 75],
      [75, 75],
      [75, 25],
      [25, 25],
    ];
  const source = input([{ ...candidate('nested'), geometryId: 'nested' }]);
  source.geometries = [
    captureGeoLabelGeometry(
      'nested',
      { type: 'MultiPolygon', coordinates: [[outer], [inner]] } as never,
      geoIdentity(),
    ),
  ];
  source.viewport = { x: 0, y: 0, width: 20, height: 20 };
  const overlay = resolveGeoOverlay(source, { k: 1, tx: -40, ty: -40 });
  expect(overlay.labels).toEqual([]);
  expect(overlay.inventory[0].visibility).not.toBe('visible');
});
it('anchors in filled overlap remainders instead of a cancelled cross-group region after clipping', () => {
  const first = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
    second = [
      [50, 0],
      [50, 100],
      [150, 100],
      [150, 0],
      [50, 0],
    ];
  const source = input([
    { ...candidate('overlap'), geometryId: 'overlap', block: { ...block, width: 8, height: 8 } },
  ]);
  source.geometries = [
    captureGeoLabelGeometry(
      'overlap',
      { type: 'MultiPolygon', coordinates: [[first], [second]] } as never,
      geoIdentity(),
    ),
  ];
  source.viewport = { x: 0, y: 0, width: 50, height: 100 };
  const overlay = resolveGeoOverlay(source, { k: 1, tx: -75, ty: 0 });
  expect(overlay.labels).toHaveLength(1);
  expect(overlay.labels[0].anchor.x).toBeGreaterThan(25);
});
