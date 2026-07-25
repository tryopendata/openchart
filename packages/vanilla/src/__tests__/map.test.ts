import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createGeoMap } from '../map-mount';

function mockReducedMotion() {
  return vi.spyOn(window, 'matchMedia').mockImplementation(
    (q) =>
      ({
        matches: q.includes('reduced-motion'),
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  );
}

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

describe('createGeoMap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts an SVG with path elements', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('oc-map')).toBe(true);

    const features = container.querySelectorAll('.oc-map-feature');
    expect(features.length).toBe(3);

    instance.destroy();
  });

  it('update() re-renders with new data', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

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
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('SVG does not have oc-chart-root class', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('oc-chart-root')).toBe(false);
    expect(svg!.classList.contains('oc-map')).toBe(true);

    instance.destroy();
  });

  it('viewBox matches layout dimensions', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute('viewBox');
    expect(viewBox).toBe(`0 0 ${instance.layout.width} ${instance.layout.height}`);

    instance.destroy();
  });

  it('no gradient legend group present for quantitative map', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

    // Old hand-rolled gradient legend used .oc-map-legend; it should be gone
    const oldLegend = container.querySelector('.oc-map-legend');
    expect(oldLegend).toBeNull();

    // Continuous legend uses the shared .oc-legend class
    const legend = container.querySelector('.oc-legend');
    expect(legend).not.toBeNull();

    instance.destroy();
  });

  it('exposes layout property', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

    expect(instance.layout).toBeDefined();
    expect(instance.layout.features.length).toBeGreaterThan(0);

    instance.destroy();
  });

  it('export("svg") returns a string containing SVG content', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

    const svgString = instance.export('svg');
    expect(typeof svgString).toBe('string');
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('oc-map');

    instance.destroy();
  });

  it('stamps data-key on feature paths equal to feature id', () => {
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

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
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

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
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

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
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

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
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

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
    const instance = createGeoMap(container, basicMapSpec, { responsive: false });

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
    const instance = createGeoMap(container, focusSpec, { responsive: false });

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

  it('chrome paints after the map group so the title sits above a zoomed map', () => {
    const chromeSpec = {
      ...basicMapSpec,
      chrome: { title: 'Test Title' },
    };
    const instance = createGeoMap(container, chromeSpec, { responsive: false });

    const svg = container.querySelector('svg')!;
    const kids = [...svg.children];
    const mapGroupIdx = kids.findIndex((k) => k.classList.contains('oc-map-group'));
    const chromeIdx = kids.findIndex((k) => k.classList.contains('oc-chrome'));
    expect(mapGroupIdx).toBeGreaterThanOrEqual(0);
    expect(chromeIdx).toBeGreaterThan(mapGroupIdx);

    instance.destroy();
  });

  it('features outside geo.focus rest at the dim opacity', () => {
    const focusSpec = {
      ...basicMapSpec,
      geo: { ...basicMapSpec.geo, focus: '36' },
    };
    const instance = createGeoMap(container, focusSpec, { responsive: false });

    const focused = container.querySelector('.oc-map-feature[data-feature-id="36"]') as SVGElement;
    const dimmed = container.querySelector('.oc-map-feature[data-feature-id="06"]') as SVGElement;
    expect(focused).not.toBeNull();
    expect(dimmed).not.toBeNull();
    // Focused feature is full opacity; a feature outside the focus set is dimmed.
    expect(dimmed.style.opacity).toBe('0.25');
    expect(focused.style.opacity === '' || focused.style.opacity === '1').toBe(true);

    instance.destroy();
  });

  // ---------------------------------------------------------------------------
  // Point layer rendering
  // ---------------------------------------------------------------------------

  describe('point layer', () => {
    const pointSpec = {
      type: 'map' as const,
      geo: { features: MINI_TOPO, projection: 'mercator' as const },
      data: [],
      encoding: {
        key: { field: 'id', type: 'nominal' as const },
      },
      points: {
        data: [
          { lat: 34, lon: -118, name: 'LA', value: 100 },
          { lat: 40.7, lon: -74, name: 'NYC', value: 500 },
        ],
        longitude: { field: 'lon', type: 'quantitative' as const },
        latitude: { field: 'lat', type: 'quantitative' as const },
        size: { field: 'value', type: 'quantitative' as const },
        key: { field: 'name', type: 'nominal' as const },
      },
    };

    it('renders point circles inside camera group', () => {
      const instance = createGeoMap(container, pointSpec, { responsive: false });

      const cameraGroup = container.querySelector('[data-oc-map-camera]');
      expect(cameraGroup).not.toBeNull();

      const points = cameraGroup!.querySelectorAll('.oc-map-point');
      expect(points.length).toBe(2);

      instance.destroy();
    });

    it('stores data-base-r on point circles', () => {
      const instance = createGeoMap(container, pointSpec, { responsive: false });

      const points = container.querySelectorAll('.oc-map-point');
      expect(points.length).toBe(2);

      for (const p of points) {
        const baseR = p.getAttribute('data-base-r');
        expect(baseR).not.toBeNull();
        const r = p.getAttribute('r');
        expect(r).not.toBeNull();
        expect(baseR).toBe(r);
      }

      instance.destroy();
    });

    it('counter-scales radius when camera is zoomed', () => {
      const instance = createGeoMap(container, pointSpec, { responsive: false });

      // Grab initial radii
      const pointsBefore = container.querySelectorAll('.oc-map-point');
      const initialRadii = Array.from(pointsBefore).map((p) =>
        Number(p.getAttribute('data-base-r')),
      );
      expect(initialRadii.length).toBe(2);
      for (const r of initialRadii) {
        expect(r).toBeGreaterThan(0);
      }

      // Zoom to New York which will scale > 1
      instance.zoomTo('36', { duration: 0 });

      // After zoom, r should be smaller than base-r (counter-scaled)
      const pointsAfter = container.querySelectorAll('.oc-map-point');
      for (let i = 0; i < pointsAfter.length; i++) {
        const currentR = Number(pointsAfter[i].getAttribute('r'));
        const baseR = Number(pointsAfter[i].getAttribute('data-base-r'));
        expect(currentR).toBeLessThan(baseR);
      }

      instance.destroy();
    });

    it('geo.focus with points: true applies camera zoom on first render', () => {
      const focusPointsSpec = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: { points: true, padding: 8 } },
        animation: false,
      };
      const instance = createGeoMap(container, focusPointsSpec, { responsive: false });

      const cameraGroup = container.querySelector('[data-oc-map-camera]');
      expect(cameraGroup).not.toBeNull();

      const transform = cameraGroup!.getAttribute('transform');
      expect(transform).not.toBeNull();
      const scaleMatch = transform!.match(/scale\(([\d.]+)\)/);
      expect(scaleMatch).not.toBeNull();
      expect(Number(scaleMatch![1])).toBeGreaterThan(1);

      instance.destroy();
    });

    it('geo.focus with points: true applies camera zoom even with entrance animation', () => {
      const focusPointsSpec = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: { points: true, padding: 8 } },
        animation: true,
      };
      const instance = createGeoMap(container, focusPointsSpec, { responsive: false });

      const cameraGroup = container.querySelector('[data-oc-map-camera]');
      expect(cameraGroup).not.toBeNull();

      const transform = cameraGroup!.getAttribute('transform');
      expect(transform).not.toBeNull();
      const scaleMatch = transform!.match(/scale\(([\d.]+)\)/);
      expect(scaleMatch).not.toBeNull();
      expect(Number(scaleMatch![1])).toBeGreaterThan(1);

      instance.destroy();
    });

    it('resize() preserves points focus camera', () => {
      const focusPointsSpec = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: { points: true, padding: 8 } },
        animation: false,
      };
      const instance = createGeoMap(container, focusPointsSpec, { responsive: false });

      // First render should have camera applied
      const cameraGroup1 = container.querySelector('[data-oc-map-camera]');
      expect(cameraGroup1!.getAttribute('transform')).not.toBeNull();

      // Simulate a resize
      instance.resize();

      // Camera should still be applied after resize
      const cameraGroup2 = container.querySelector('[data-oc-map-camera]');
      expect(cameraGroup2).not.toBeNull();
      const transform = cameraGroup2!.getAttribute('transform');
      expect(transform).not.toBeNull();
      const scaleMatch = transform!.match(/scale\(([\d.]+)\)/);
      expect(scaleMatch).not.toBeNull();
      expect(Number(scaleMatch![1])).toBeGreaterThan(1);

      instance.destroy();
    });

    it('geo.focus with points filter applies camera zoom on first render', () => {
      const focusPointsSpec = {
        ...pointSpec,
        geo: {
          ...pointSpec.geo,
          focus: { points: { field: 'name', value: 'NYC' }, padding: 12 },
        },
        animation: false,
      };
      const instance = createGeoMap(container, focusPointsSpec, { responsive: false });

      const cameraGroup = container.querySelector('[data-oc-map-camera]');
      expect(cameraGroup).not.toBeNull();

      const transform = cameraGroup!.getAttribute('transform');
      expect(transform).not.toBeNull();
      const scaleMatch = transform!.match(/scale\(([\d.]+)\)/);
      expect(scaleMatch).not.toBeNull();
      expect(Number(scaleMatch![1])).toBeGreaterThan(1);

      instance.destroy();
    });

    it('update() with changed points focus drives camera (tween)', () => {
      const spec1 = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: { points: true, padding: 8 } },
        animation: false,
      };
      const instance = createGeoMap(container, spec1, { responsive: false });

      const transform1 = container.querySelector('[data-oc-map-camera]')!.getAttribute('transform');
      expect(transform1).not.toBeNull();

      // Mock reduced-motion AFTER createGeoMap so it only affects update()'s
      // driveCamera() call, making the tween snap instantly.
      const spy = mockReducedMotion();

      const spec2 = {
        ...pointSpec,
        geo: {
          ...pointSpec.geo,
          focus: { points: { field: 'name', value: 'NYC' }, padding: 12 },
        },
        animation: false,
      };
      instance.update(spec2);

      // Re-query after update (render creates a new SVG)
      const transform2 = container.querySelector('[data-oc-map-camera]')!.getAttribute('transform');
      expect(transform2).not.toBeNull();
      expect(transform2).not.toBe(transform1);

      spy.mockRestore();
      instance.destroy();
    });

    it('update() null -> features -> points -> null preserves camera at each step', () => {
      // Reproduces the scrollytelling sequence: full view -> zoom to counties ->
      // zoom to points cluster -> back to full view
      const spy = mockReducedMotion();

      // Step 0: no focus
      const specStep0 = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: null },
        animation: false,
      };
      const instance = createGeoMap(container, specStep0, { responsive: false });
      const cg0 = container.querySelector('[data-oc-map-camera]')!;
      expect(cg0.getAttribute('transform')).toBeNull();

      // Step 1: feature focus
      const specStep1 = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: { features: ['48'], padding: 0 } },
        animation: false,
      };
      instance.update(specStep1);
      const cg1 = container.querySelector('[data-oc-map-camera]')!;
      const t1 = cg1.getAttribute('transform');
      expect(t1).not.toBeNull();
      const scale1 = Number(t1!.match(/scale\(([\d.]+)\)/)![1]);
      expect(scale1).toBeGreaterThan(1);

      // Step 2: points focus (the transition that breaks in production)
      const specStep2 = {
        ...pointSpec,
        geo: {
          ...pointSpec.geo,
          focus: { points: { field: 'name', value: 'NYC' }, padding: 0 },
        },
        animation: false,
      };
      instance.update(specStep2);
      const cg2 = container.querySelector('[data-oc-map-camera]')!;
      const t2 = cg2.getAttribute('transform');
      expect(t2).not.toBeNull();
      const scale2 = Number(t2!.match(/scale\(([\d.]+)\)/)![1]);
      expect(scale2).toBeGreaterThan(1);

      // Step 3: back to null
      const specStep3 = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: null },
        animation: false,
      };
      instance.update(specStep3);
      const cg3 = container.querySelector('[data-oc-map-camera]')!;
      expect(cg3.getAttribute('transform')).toBeNull();

      spy.mockRestore();
      instance.destroy();
    });

    it('update() from points focus to null resets camera', () => {
      const spec1 = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: { points: true, padding: 8 } },
        animation: false,
      };
      const instance = createGeoMap(container, spec1, { responsive: false });

      expect(
        container.querySelector('[data-oc-map-camera]')!.getAttribute('transform'),
      ).not.toBeNull();

      const spy = mockReducedMotion();

      const spec2 = {
        ...pointSpec,
        geo: { ...pointSpec.geo, focus: null },
        animation: false,
      };
      instance.update(spec2);

      // Re-query after update
      const transform = container.querySelector('[data-oc-map-camera]')!.getAttribute('transform');
      expect(transform).toBeNull();

      spy.mockRestore();
      instance.destroy();
    });
  });
});
