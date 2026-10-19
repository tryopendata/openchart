import type { GeoLabelComponent, Point } from '@opendata-ai/openchart-core';
import { geoAlbersUsa, geoEqualEarth, geoIdentity, geoMercator, geoPath } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import {
  captureGeoLabelGeometries,
  captureGeoLabelGeometry,
  clipGeoLabelComponent,
  componentArea,
  componentContains,
  findInteriorAnchor,
  reconstructProjectedComponents,
} from '../label-geometry';

const ring = (coords: number[][]): Point[] => coords.map(([x, y]) => ({ x, y }));
const square = ring([
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
]);
const donut: GeoLabelComponent = {
  index: 0,
  exterior: square,
  holes: [
    ring([
      [30, 30],
      [30, 70],
      [70, 70],
      [70, 30],
    ]),
  ],
};
describe('projected map label geometry', () => {
  it('proves an interior outside a donut hole and concave water', () => {
    for (const component of [
      donut,
      {
        index: 0,
        exterior: ring([
          [0, 0],
          [100, 0],
          [100, 20],
          [20, 20],
          [20, 100],
          [0, 100],
        ]),
        holes: [],
      },
    ]) {
      const anchor = findInteriorAnchor(component)!;
      expect(anchor).toBeDefined();
      expect(componentContains(component, anchor)).toBe(true);
    }
  });
  it('keeps holes separate after reconstructing reordered and reversed emitted rings', () => {
    const components = reconstructProjectedComponents([
      [...donut.holes[0]].reverse(),
      [...square].reverse(),
    ]);
    expect(components).toHaveLength(1);
    expect(components[0].holes).toHaveLength(1);
    expect(componentArea(components[0])).toBe(8400);
  });
  it('clips a complete donut, including a hole crossing the viewport', () => {
    const clipped = clipGeoLabelComponent(donut, { x: 0, y: 0, width: 50, height: 100 });
    expect(clipped.reduce((sum, c) => sum + componentArea(c), 0)).toBeCloseTo(4200);
    for (const c of clipped) {
      const p = findInteriorAnchor(c)!;
      expect(componentContains(donut, p)).toBe(true);
      expect(p.x).toBeLessThanOrEqual(50);
    }
  });
  it('splits a concavity into distinct visible islands', () => {
    const shape = {
      index: 0,
      exterior: ring([
        [0, 0],
        [100, 0],
        [100, 100],
        [80, 100],
        [80, 20],
        [20, 20],
        [20, 100],
        [0, 100],
      ]),
      holes: [],
    };
    const clipped = clipGeoLabelComponent(shape, { x: 0, y: 30, width: 100, height: 70 });
    expect(clipped).toHaveLength(2);
    expect(clipped.reduce((sum, c) => sum + componentArea(c), 0)).toBeCloseTo(2800);
  });
  it('captures the exact fitted projection stream through an antimeridian cut', () => {
    const feature = {
      type: 'Polygon',
      coordinates: [
        [
          [170, -20],
          [170, 20],
          [-170, 20],
          [-170, -20],
          [170, -20],
        ],
      ],
    } as const;
    const projection = geoMercator().fitSize([400, 200], feature as never);
    const result = captureGeoLabelGeometry('cut', feature as never, projection);
    expect(result.components!.length).toBeGreaterThanOrEqual(2);
    expect(result.canonicalAnchor).toBeDefined();
    const bounds = geoPath(projection).bounds(feature as never);
    expect(result.bounds.x).toBeCloseTo(bounds[0][0]);
    expect(result.bounds.width).toBeCloseTo(bounds[1][0] - bounds[0][0]);
  });
  it('captures projection resampling and retains all holes without mutation', () => {
    const feature = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 20],
          [20, 20],
          [20, 0],
          [0, 0],
        ],
        [
          [5, 5],
          [15, 5],
          [15, 15],
          [5, 15],
          [5, 5],
        ],
      ],
    };
    const before = structuredClone(feature);
    const projection = geoEqualEarth().fitSize([400, 200], feature as never);
    const result = captureGeoLabelGeometry('hole', feature as never, projection);
    expect(result.components![0].holes).toHaveLength(1);
    expect(result.components!.some((c) => componentContains(c, result.canonicalAnchor!))).toBe(
      true,
    );
    expect(feature).toEqual(before);
  });
  it('retains whole features atomically at the exact vertex limit, with proven fallback', () => {
    const feature = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
      ],
    };
    const diagnostics: string[] = [];
    const result = captureGeoLabelGeometries(
      [
        { featureId: 'A', feature: feature as never },
        { featureId: 'B', feature: feature as never },
      ],
      geoIdentity(),
      { maxVertices: 4, onDiagnostic: (m) => diagnostics.push(m) },
    );
    expect(result[0].mode).toBe('retained');
    expect(result[0].vertexCount).toBe(4);
    expect(result[1].mode).toBe('fallback');
    expect(result[1].components).toBeUndefined();
    expect(result[1].canonicalAnchor).toEqual({ x: 50, y: 50 });
    expect(diagnostics).toHaveLength(1);
  });
  it('does not invent an anchor for degenerate or exhausted geometry', () => {
    expect(
      findInteriorAnchor({
        index: 0,
        exterior: ring([
          [0, 0],
          [10, 0],
          [20, 0],
        ]),
        holes: [],
      }),
    ).toBeUndefined();
    expect(findInteriorAnchor(donut, { maxSearchCells: 0 })).toBeUndefined();
  });
});

it('diagnoses ambiguous touching and crossing rings instead of turning a hole into land', () => {
  for (const hole of [
    ring([
      [0, 20],
      [20, 20],
      [20, 40],
      [0, 40],
    ]),
    ring([
      [90, 20],
      [110, 20],
      [110, 40],
      [90, 40],
    ]),
  ]) {
    const diagnostics: string[] = [];
    expect(reconstructProjectedComponents([square, hole], (m) => diagnostics.push(m))).toEqual([]);
    expect(diagnostics.length).toBeGreaterThan(0);
  }
});

it('keeps a streaming-proven canonical fallback after the transient ring collector limit', () => {
  const diagnostics: string[] = [];
  const feature = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [0, 0],
      ],
    ],
  };
  const result = captureGeoLabelGeometry('large', feature as never, geoIdentity(), {
    maxCaptureVertices: 3,
    onDiagnostic: (m) => diagnostics.push(m),
  });
  expect(result).toMatchObject({ mode: 'fallback', captureLimited: true, vertexCount: 0 });
  expect(result.components).toBeUndefined();
  expect(result.canonicalAnchor).toEqual({ x: 50, y: 50 });
  expect(diagnostics[0]).toContain('streaming-validated');
});
it('proves120k-vertex simple interiors without retaining their rings', () => {
  const coordinates = Array.from({ length: 120_000 }, (_, i) => [
    50 + 40 * Math.cos((i / 120000) * Math.PI * 2),
    50 + 40 * Math.sin((i / 120000) * Math.PI * 2),
  ]);
  coordinates.push(coordinates[0]);
  const result = captureGeoLabelGeometry(
    'dense',
    { type: 'Polygon', coordinates: [coordinates] } as never,
    geoIdentity(),
  );
  expect(result).toMatchObject({ mode: 'fallback', captureLimited: true, vertexCount: 0 });
  expect(result.canonicalAnchor!.x).toBeCloseTo(50);
  expect(result.canonicalAnchor!.y).toBeCloseTo(50);
});
it('streaming fallback never puts a canonical anchor inside a hole or unproven thin strip', () => {
  for (const component of [
    donut,
    {
      index: 0,
      exterior: square,
      holes: [
        ring([
          [0.000001, 0.000001],
          [0.000001, 99.999999],
          [99.999999, 99.999999],
          [99.999999, 0.000001],
        ]),
      ],
    },
  ]) {
    const coords = [component.exterior, ...component.holes].map((r) =>
      [...r, r[0]].map((p) => [p.x, p.y]),
    );
    const result = captureGeoLabelGeometry(
      'hole',
      { type: 'Polygon', coordinates: coords } as never,
      geoIdentity(),
      { maxCaptureVertices: 3 },
    );
    if (result.canonicalAnchor)
      expect(componentContains(component, result.canonicalAnchor)).toBe(true);
    else expect(result.mode).toBe('unresolved');
  }
});

it('preserves hole subtraction where an antimeridian cut opens the hole into two exterior notches', () => {
  const feature = {
    type: 'Polygon',
    coordinates: [
      [
        [170, -20],
        [170, 20],
        [-170, 20],
        [-170, -20],
        [170, -20],
      ],
      [
        [175, -10],
        [-175, -10],
        [-175, 10],
        [175, 10],
        [175, -10],
      ],
    ],
  };
  const projection = geoMercator().fitSize([400, 200], feature as never);
  const geometry = captureGeoLabelGeometry('cut-hole', feature as never, projection);
  expect(geometry.components!.length).toBeGreaterThanOrEqual(2);
  expect(geometry.components!.reduce((sum, c) => sum + componentArea(c), 0)).toBeCloseTo(
    geoPath(projection).area(feature as never),
    5,
  );
  expect(geometry.components!.some((c) => componentContains(c, geometry.canonicalAnchor!))).toBe(
    true,
  );
});
it('preserves independent Albers-USA polygon groups and component anchors', () => {
  const feature = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-160, 19],
          [-160, 23],
          [-154, 23],
          [-154, 19],
          [-160, 19],
        ],
      ],
      [
        [
          [-150, 60],
          [-150, 65],
          [-140, 65],
          [-140, 60],
          [-150, 60],
        ],
      ],
      [
        [
          [-105, 35],
          [-105, 40],
          [-100, 40],
          [-100, 35],
          [-105, 35],
        ],
      ],
    ],
  };
  const projection = geoAlbersUsa().fitSize([600, 400], feature as never);
  const result = captureGeoLabelGeometry('three', feature as never, projection);
  expect(result.components!.length).toBeGreaterThanOrEqual(3);
  expect(result.components!.some((c) => componentContains(c, result.canonicalAnchor!))).toBe(true);
  expect(result.components!.reduce((sum, c) => sum + componentArea(c), 0)).toBeCloseTo(
    geoPath(projection).area(feature as never),
    5,
  );
});
it('keeps a hole touching the viewport edge excluded, including a viewport completely inside the hole', () => {
  const clipped = clipGeoLabelComponent(donut, { x: 30, y: 0, width: 70, height: 100 });
  expect(clipped.reduce((sum, c) => sum + componentArea(c), 0)).toBeCloseTo(5400);
  for (const c of clipped) expect(componentContains(donut, findInteriorAnchor(c)!)).toBe(true);
  expect(clipGeoLabelComponent(donut, { x: 40, y: 40, width: 10, height: 10 })).toEqual([]);
});

it('uses the largest valid component when bounded search cannot prove the larger donut interior', () => {
  const coords = (r: Point[]) => [...r, r[0]].map((p) => [p.x, p.y]);
  const smaller = ring([
    [200, 0],
    [220, 0],
    [220, 20],
    [200, 20],
  ]);
  const feature = {
    type: 'MultiPolygon',
    coordinates: [[coords(donut.exterior), ...donut.holes.map(coords)], [coords(smaller)]],
  };
  const result = captureGeoLabelGeometry('largest-valid', feature as never, geoIdentity(), {
    maxSearchCells: 1,
  });
  expect(result.canonicalAnchor).toEqual({ x: 210, y: 10 });
  expect(result.searchLimited).toBe(true);
});

it('does not infer land from opposite-oriented duplicate polygons whose SVG nonzero fill cancels', () => {
  const outer = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [0, 0],
  ];
  const feature = { type: 'MultiPolygon', coordinates: [[outer], [[...outer].reverse()]] };
  for (const maxCaptureVertices of [100_000, 3]) {
    const result = captureGeoLabelGeometry('cancelled', feature as never, geoIdentity(), {
      maxCaptureVertices,
    });
    expect(result.canonicalAnchor).toBeUndefined();
    expect(result.mode).toBe('unresolved');
  }
});
it('retains all disjoint unequal triangular holes without quadratic parent searches', () => {
  const holes = Array.from({ length: 3000 }, (_, i) => {
    const x = 2 + (i % 100) * 10,
      y = 2 + Math.floor(i / 100) * 10,
      s = 1 + (i % 7) * 0.05;
    return ring([
      [x, y],
      [x + s, y],
      [x, y + s],
    ]);
  });
  const components = reconstructProjectedComponents([
    ring([
      [0, 0],
      [1002, 0],
      [1002, 302],
      [0, 302],
    ]),
    ...holes,
  ]);
  expect(components).toHaveLength(1);
  expect(components[0].holes).toHaveLength(3000);
  const anchor = findInteriorAnchor(components[0]);
  expect(anchor).toBeDefined();
  expect(componentContains(components[0], anchor!)).toBe(true);
});

it('keeps nested opposite-wound cancellation out of both retained and streaming anchors', () => {
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
  const feature = { type: 'MultiPolygon', coordinates: [[outer], [inner]] };
  for (const maxCaptureVertices of [100_000, 3]) {
    const result = captureGeoLabelGeometry('nested', feature as never, geoIdentity(), {
      maxCaptureVertices,
    });
    const point = result.canonicalAnchor!;
    expect(point).toBeDefined();
    expect(point.x < 25 || point.x > 75 || point.y < 25 || point.y > 75).toBe(true);
  }
});

it('rejects the whole feature when dropping an unproven polygon group would hide cancellation', () => {
  const a = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
    touching = [
      [0, 10],
      [10, 10],
      [10, 20],
      [0, 20],
      [0, 10],
    ];
  const diagnostics: string[] = [];
  const result = captureGeoLabelGeometry(
    'unproven',
    { type: 'MultiPolygon', coordinates: [[a], [[...a].reverse(), touching]] } as never,
    geoIdentity(),
    { onDiagnostic: (m) => diagnostics.push(m) },
  );
  expect(result.mode).toBe('unresolved');
  expect(result.canonicalAnchor).toBeUndefined();
  expect(result.components).toBeUndefined();
  expect(diagnostics.some((m) => m.includes('full-feature nonzero'))).toBe(true);
});
it('shares proof work across many cancelled components instead of resetting it per component', () => {
  const polygons = Array.from({ length: 300 }, (_, i) => {
    const x = (i % 30) * 4,
      y = Math.floor(i / 30) * 4,
      a = [
        [x, y],
        [x + 3, y],
        [x + 3, y + 3],
        [x, y + 3],
        [x, y],
      ];
    return [[a], [[...a].reverse()]];
  }).flat();
  const diagnostics: string[] = [];
  const result = captureGeoLabelGeometry(
    'cancelled-many',
    { type: 'MultiPolygon', coordinates: polygons } as never,
    geoIdentity(),
    { onDiagnostic: (m) => diagnostics.push(m) },
  );
  expect(result.canonicalAnchor).toBeUndefined();
  expect(result.mode).toBe('unresolved');
  expect(diagnostics.some((m) => m.includes('budget') || m.includes('cell limit'))).toBe(true);
});

it('does not discard a zero-signed-area self-crossing group whose lobes cancel other fill', () => {
  const a = [
      [0, 0],
      [100, 0],
      [100, 40],
      [0, 40],
      [0, 0],
    ],
    bow = [
      [0, 0],
      [100, 100],
      [0, 100],
      [100, 0],
      [0, 0],
    ];
  const diagnostics: string[] = [];
  const result = captureGeoLabelGeometry(
    'bowtie',
    { type: 'MultiPolygon', coordinates: [[a], [bow]] } as never,
    geoIdentity(),
    { onDiagnostic: (m) => diagnostics.push(m) },
  );
  expect(result.mode).toBe('unresolved');
  expect(result.canonicalAnchor).toBeUndefined();
  expect(diagnostics.some((m) => m.includes('zero-area'))).toBe(true);
});

it('falls back atomically when valid disjoint holes exceed the nesting proof budget', () => {
  const count = 1000,
    outer = ring([
      [0, 0],
      [100, 0],
      [100, 4 * count + 4],
      [0, 4 * count + 4],
    ]);
  const holes = Array.from({ length: count }, (_, i) => {
    const s = 1 + i / count,
      y = 4 * i + 1;
    return ring([
      [40, y],
      [40, y + s],
      [50 + s, y],
    ]);
  });
  const diagnostics: string[] = [];
  expect(reconstructProjectedComponents([outer, ...holes], (m) => diagnostics.push(m))).toEqual([]);
  expect(diagnostics.some((m) => m.includes('bounded containment budget'))).toBe(true);
  const coordinates = [outer, ...holes].map((r) => [...r, r[0]].map((p) => [p.x, p.y]));
  const feature = { type: 'Polygon', coordinates };
  const before = structuredClone(feature);
  const result = captureGeoLabelGeometry('bounded', { ...feature } as never, geoIdentity());
  expect(result.mode).toBe('fallback');
  expect(result.searchLimited).toBe(true);
  expect(result.vertexCount).toBe(0);
  expect(result.components).toBeUndefined();
  expect(componentContains({ index: 0, exterior: outer, holes }, result.canonicalAnchor!)).toBe(
    true,
  );
  expect(feature).toEqual(before);
});

it('does not hide a zero-area crossing behind an arbitrarily tiny initial segment', () => {
  const a = [
      [0, 0],
      [100, 0],
      [100, 40],
      [0, 40],
      [0, 0],
    ],
    bow = [
      [0, 0],
      [1e-12, 0],
      [100, 100],
      [0, 100],
      [100, 0],
      [0, 0],
    ];
  const result = captureGeoLabelGeometry(
    'tiny-first-segment',
    { type: 'MultiPolygon', coordinates: [[a], [bow]] } as never,
    geoIdentity(),
  );
  expect(result.mode).toBe('unresolved');
  expect(result.canonicalAnchor).toBeUndefined();
});

it('does not treat a sub-epsilon cancelling strip as absent fill', () => {
  const a = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
    thin = [
      [50 - 1e-10, 45],
      [50 - 1e-10, 55],
      [50 + 1e-10, 55],
      [50 + 1e-10, 45],
      [50 - 1e-10, 45],
    ];
  const result = captureGeoLabelGeometry(
    'thin-cancellation',
    { type: 'MultiPolygon', coordinates: [[a], [thin]] } as never,
    geoIdentity(),
  );
  expect(result.mode).toBe('unresolved');
  expect(result.canonicalAnchor).toBeUndefined();
});
