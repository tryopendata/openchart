/**
 * Near-miss validation messages for VL idioms that are unsupported by
 * decision. Each rejection must point the author at the openchart
 * equivalent instead of failing with a generic type error.
 */

import { describe, expect, it } from 'vitest';
import { validateSpec } from '../validate';

const encoding = {
  x: { field: 'cat', type: 'nominal' },
  y: { field: 'value', type: 'quantitative' },
};
const data = [
  { cat: 'A', value: 10 },
  { cat: 'B', value: 20 },
];

describe('near-miss validation messages', () => {
  it('rejects data.url with a pointer to inline data', () => {
    const result = validateSpec({ mark: 'bar', data: { url: '/data.json' }, encoding });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'data.url');
    expect(error?.message).toContain('does not fetch remote data');
    expect(error?.suggestion).toContain('inline');
  });

  it('rejects the string form of calculate with the structured equivalent', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      transform: [{ calculate: 'datum.a / datum.b', as: 'ratio' }],
      encoding,
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'transform[0].calculate');
    expect(error?.message).toContain('structured expression object');
    expect(error?.suggestion).toContain('calculate: { op:');
  });

  it('rejects hconcat/vconcat with the side-by-side containers suggestion', () => {
    for (const key of ['hconcat', 'vconcat']) {
      const result = validateSpec({ [key]: [] });
      expect(result.valid).toBe(false);
      const error = result.errors.find((e) => e.path === key);
      expect(error?.message).toContain(`"${key}" composition is not supported`);
      expect(error?.suggestion).toContain('facet');
    }
  });

  it('rejects the top-level facet operator with the facet channel suggestion', () => {
    const result = validateSpec({
      facet: { field: 'cat', type: 'nominal' },
      spec: { mark: 'bar', encoding },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'facet');
    expect(error?.message).toContain('"facet" operator is not supported');
    expect(error?.suggestion).toContain('encoding.facet');
  });

  it('rejects unknown scheme names with the supported list', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      encoding: {
        ...encoding,
        color: { field: 'value', type: 'quantitative', scale: { scheme: 'viridis' } },
      },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'encoding.color.scale.scheme');
    expect(error?.message).toContain('"viridis" is not a supported scheme name');
    expect(error?.suggestion).toContain('blues');
    expect(error?.suggestion).toContain('scale.range');
  });

  it('accepts known scheme names (resolved by sugar before validation on the compile path)', () => {
    const result = validateSpec({
      mark: 'bar',
      data,
      encoding: {
        ...encoding,
        color: { field: 'value', type: 'quantitative', scale: { scheme: 'blues' } },
      },
    });
    expect(result.errors.filter((e) => e.path === 'encoding.color.scale.scheme')).toHaveLength(0);
  });
});

describe('scale.scheme on non-chart specs', () => {
  it('rejects any scheme on a sankey color channel as dead config', () => {
    // Sankey never reads scale.scheme (node colors cycle theme.colors.categorical),
    // so even a known name like "blues" must not be silently accepted.
    for (const scheme of ['viridis', 'blues']) {
      const result = validateSpec({
        type: 'sankey',
        data: [{ source: 'A', target: 'B', value: 10 }],
        encoding: {
          source: { field: 'source', type: 'nominal' },
          target: { field: 'target', type: 'nominal' },
          value: { field: 'value', type: 'quantitative' },
          color: { field: 'source', type: 'nominal', scale: { scheme } },
        },
      });
      expect(result.valid).toBe(false);
      const error = result.errors.find((e) => e.path === 'encoding.color.scale.scheme');
      expect(error?.code).toBe('INVALID_VALUE');
      expect(error?.message).toContain('has no effect');
      expect(error?.suggestion).toContain('theme.colors.categorical');
    }
  });

  it('rejects any scheme on a tilemap value channel, pointing at the palette prop', () => {
    const result = validateSpec({
      type: 'tilemap',
      data: [{ state: 'CA', value: 12000 }],
      encoding: {
        state: { field: 'state', type: 'nominal' },
        value: { field: 'value', type: 'quantitative', scale: { scheme: 'viridis' } },
      },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'encoding.value.scale.scheme');
    expect(error?.code).toBe('INVALID_VALUE');
    expect(error?.message).toContain('has no effect');
    expect(error?.suggestion).toContain('palette: "green"');
  });

  it('rejects any scheme on a barlist color channel as dead config', () => {
    const result = validateSpec({
      type: 'barlist',
      data: [{ label: 'A', value: 42, group: 'x' }],
      encoding: {
        label: { field: 'label', type: 'nominal' },
        value: { field: 'value', type: 'quantitative' },
        color: { field: 'group', type: 'nominal', scale: { scheme: 'viridis' } },
      },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'encoding.color.scale.scheme');
    expect(error?.code).toBe('INVALID_VALUE');
    expect(error?.message).toContain('has no effect');
  });

  it('rejects an unknown scheme on a graph nodeColor channel (graph honors scale.range)', () => {
    const result = validateSpec({
      type: 'graph',
      nodes: [{ id: 'a', category: 'x' }],
      edges: [],
      encoding: {
        nodeColor: { field: 'category', type: 'nominal', scale: { scheme: 'viridis' } },
      },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'encoding.nodeColor.scale.scheme');
    expect(error?.code).toBe('INVALID_VALUE');
    expect(error?.message).toContain('"viridis" is not a supported scheme name');
    expect(error?.suggestion).toContain('scale.range');
  });
});

describe('scale.scheme on map specs', () => {
  // Minimal valid TopoJSON topology with one feature
  const topo = {
    type: 'Topology',
    objects: {
      things: {
        type: 'GeometryCollection',
        geometries: [{ type: 'Polygon', arcs: [[0]], id: '01' }],
      },
    },
    arcs: [
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [-1, -1],
      ],
    ],
  };

  it('rejects a scheme the map palette set does not support', () => {
    const result = validateSpec({
      type: 'map',
      geo: { features: topo },
      data: [{ id: '01', value: 5 }],
      encoding: {
        key: { field: 'id' },
        color: { field: 'value', type: 'quantitative', scale: { scheme: 'viridis' } },
      },
    });
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.path === 'encoding.color.scale.scheme');
    expect(error?.code).toBe('INVALID_VALUE');
    expect(error?.message).toContain('"viridis" is not a supported map palette');
    expect(error?.suggestion).toContain('green');
  });

  it('accepts a supported sequential palette on a map color channel', () => {
    const result = validateSpec({
      type: 'map',
      geo: { features: topo },
      data: [{ id: '01', value: 5 }],
      encoding: {
        key: { field: 'id' },
        color: { field: 'value', type: 'quantitative', scale: { scheme: 'green' } },
      },
    });
    expect(result.errors.filter((e) => e.path === 'encoding.color.scale.scheme')).toHaveLength(0);
  });

  it('rejects an unsupported scheme on the points layer color channel', () => {
    const result = validateSpec({
      type: 'map',
      geo: { features: topo },
      data: [],
      encoding: { key: { field: 'id' } },
      points: {
        data: [{ lat: 30, lon: -97, score: 1 }],
        latitude: { field: 'lat' },
        longitude: { field: 'lon' },
        color: { field: 'score', type: 'quantitative', scale: { scheme: 'magma' } },
      },
    });
    const error = result.errors.find((e) => e.path === 'points.color.scale.scheme');
    expect(error?.code).toBe('INVALID_VALUE');
    expect(error?.message).toContain('"magma" is not a supported map palette');
  });
});
