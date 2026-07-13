import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('SVG does not have oc-chart-root class', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('oc-chart-root')).toBe(false);
    expect(svg!.classList.contains('oc-map')).toBe(true);

    instance.destroy();
  });

  it('viewBox matches layout dimensions', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute('viewBox');
    expect(viewBox).toBe(`0 0 ${instance.layout.width} ${instance.layout.height}`);

    instance.destroy();
  });

  it('no gradient legend group present for quantitative map', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    // Old hand-rolled gradient legend used .oc-map-legend; it should be gone
    const oldLegend = container.querySelector('.oc-map-legend');
    expect(oldLegend).toBeNull();

    // Continuous legend uses the shared .oc-legend class
    const legend = container.querySelector('.oc-legend');
    expect(legend).not.toBeNull();

    instance.destroy();
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

  it('stamps data-key on feature paths equal to feature id', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const features = container.querySelectorAll('.oc-map-feature');
    for (const feature of features) {
      const featureId = feature.getAttribute('data-feature-id');
      const dataKey = feature.getAttribute('data-key');
      expect(dataKey).not.toBeNull();
      expect(dataKey).toBe(featureId);
    }

    instance.destroy();
  });

  it('stagger custom property is at most 80ms for any feature count', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const staggerValue = svg!.style.getPropertyValue('--oc-animation-stagger');
    if (staggerValue) {
      const numericMs = parseFloat(staggerValue);
      expect(numericMs).toBeLessThanOrEqual(80);
    }

    instance.destroy();
  });

  it('camera group [data-oc-map-camera] wraps features and borders', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const cameraGroup = container.querySelector('[data-oc-map-camera]');
    expect(cameraGroup).not.toBeNull();

    // Features and borders should be inside the camera group
    const features = cameraGroup!.querySelector('.oc-map-features');
    const borders = cameraGroup!.querySelector('.oc-map-borders');
    expect(features).not.toBeNull();
    expect(borders).not.toBeNull();

    // Chrome and legend should NOT be inside the camera group
    const chrome = cameraGroup!.querySelector('.oc-chrome');
    expect(chrome).toBeNull();

    instance.destroy();
  });

  it('zoomTo applies a transform with scale > 1 and sets vector-effect', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    // Use New York ('36') which is small enough relative to the full map to produce a zoom > 1
    instance.zoomTo('36', { duration: 0 });

    const cameraGroup = container.querySelector('[data-oc-map-camera]');
    expect(cameraGroup).not.toBeNull();

    const transform = cameraGroup!.getAttribute('transform');
    expect(transform).not.toBeNull();
    // Transform should contain a scale factor > 1
    const scaleMatch = transform!.match(/scale\(([\d.]+)\)/);
    expect(scaleMatch).not.toBeNull();
    expect(Number(scaleMatch![1])).toBeGreaterThan(1);

    // vector-effect should be set on feature paths
    const featurePaths = container.querySelectorAll('.oc-map-feature');
    for (const p of featurePaths) {
      expect(p.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    }

    instance.destroy();
  });

  it('resetView removes the transform and vector-effect', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    // First zoom in to New York (small enough to produce zoom > 1)
    instance.zoomTo('36', { duration: 0 });
    const cameraGroup = container.querySelector('[data-oc-map-camera]');
    expect(cameraGroup!.getAttribute('transform')).not.toBeNull();

    // Then reset
    instance.resetView({ duration: 0 });
    expect(cameraGroup!.getAttribute('transform')).toBeNull();

    // vector-effect should be removed
    const featurePaths = container.querySelectorAll('.oc-map-feature');
    for (const p of featurePaths) {
      expect(p.getAttribute('vector-effect')).toBeNull();
    }

    instance.destroy();
  });

  it('zoomTo with unknown feature id warns via console.warn', () => {
    const instance = createMap(container, basicMapSpec, { responsive: false });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    instance.zoomTo('NONEXISTENT', { duration: 0 });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('NONEXISTENT');

    warnSpy.mockRestore();
    instance.destroy();
  });

  it('spec with geo.focus snaps camera on first render', () => {
    const focusSpec = {
      ...basicMapSpec,
      geo: { ...basicMapSpec.geo, focus: '36' },
    };
    const instance = createMap(container, focusSpec, { responsive: false });

    const cameraGroup = container.querySelector('[data-oc-map-camera]');
    expect(cameraGroup).not.toBeNull();

    // Camera should be applied (transform present because '36' is small enough to zoom)
    const transform = cameraGroup!.getAttribute('transform');
    expect(transform).not.toBeNull();
    const scaleMatch = transform!.match(/scale\(([\d.]+)\)/);
    expect(scaleMatch).not.toBeNull();
    expect(Number(scaleMatch![1])).toBeGreaterThan(1);

    instance.destroy();
  });
});
