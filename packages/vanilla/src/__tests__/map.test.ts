import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createMap } from '../map-mount';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// Minimal valid TopoJSON with 3 US states (delta-encoded arcs).
const MINI_TOPO = {
  type: 'Topology',
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
        { type: 'Polygon', id: '36', properties: { name: 'New York' }, arcs: [[2]] },
      ],
    },
  },
  arcs: [
    [
      [-122, 37],
      [4, -3],
      [-3, 2],
      [-1, 1],
    ],
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
    [
      [-74, 41],
      [1, -1],
      [-3, 2],
      [2, -1],
    ],
  ],
};

const basicMapSpec = {
  type: 'map' as const,
  geo: { features: MINI_TOPO, projection: 'mercator' as const },
  data: [
    { fips: '06', value: 10 },
    { fips: '48', value: 20 },
  ],
  encoding: {
    key: { field: 'fips', type: 'nominal' as const },
    color: { field: 'value', type: 'quantitative' as const },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createMap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts an SVG with path elements', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('oc-map')).toBe(true);

    const features = container.querySelectorAll('.oc-map-feature');
    expect(features.length).toBe(3);

    instance.destroy();
  });

  it('update() re-renders with new data', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    instance.update({
      ...basicMapSpec,
      data: [
        { fips: '06', value: 100 },
        { fips: '48', value: 200 },
        { fips: '36', value: 300 },
      ],
    });

    const features = container.querySelectorAll('.oc-map-feature');
    expect(features.length).toBe(3);

    instance.destroy();
  });

  it('destroy() removes SVG from DOM', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('exposes layout property', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    expect(instance.layout).toBeDefined();
    expect(instance.layout.features.length).toBeGreaterThan(0);

    instance.destroy();
  });

  it('export("svg") returns a string containing SVG content', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const svgString = instance.export('svg');
    expect(typeof svgString).toBe('string');
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('oc-map');

    instance.destroy();
  });
});
