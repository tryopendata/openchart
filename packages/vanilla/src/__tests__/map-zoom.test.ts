import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import {
  clampMapCamera,
  DEFAULT_MAX_ZOOM,
  panCamera,
  resolveMapZoom,
  wheelZoomFactor,
  zoomCameraAt,
} from '../map-camera';
import { createGeoMap, type GeoMapInstance } from '../map-mount';
import type { Camera } from '../story/camera-math';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Minimal valid TopoJSON with 3 US states (delta-encoded arcs), as in map.test.ts.
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

function zoomSpec(zoom: GeoMapSpec['geo']['zoom'] = true): GeoMapSpec {
  return {
    type: 'map',
    geo: { features: MINI_TOPO, projection: 'mercator', zoom },
    data: [],
    encoding: { key: { field: 'id', type: 'nominal' } },
    points: {
      data: [
        { lat: 34, lon: -118, name: 'LA', value: 100 },
        { lat: 40.7, lon: -74, name: 'NYC', value: 500 },
      ],
      longitude: { field: 'lon', type: 'quantitative' },
      latitude: { field: 'lat', type: 'quantitative' },
      size: { field: 'value', type: 'quantitative' },
      key: { field: 'name', type: 'nominal' },
      tooltip: [{ field: 'name', type: 'nominal' }],
    },
  };
}

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

/** Client coordinates of a map-frame point (the test container maps 1:1). */
function clientAt(inst: GeoMapInstance, fx: number, fy: number) {
  const { area } = inst.layout;
  return { clientX: area.x + fx, clientY: area.y + fy };
}

function mapCenter(inst: GeoMapInstance) {
  const { mapSize } = inst.layout;
  return clientAt(inst, mapSize.width / 2, mapSize.height / 2);
}

function wheel(target: Element, init: WheelEventInit): WheelEvent {
  const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  // happy-dom's WheelEvent drops the MouseEvent init fields; restore them.
  for (const k of ['clientX', 'clientY', 'ctrlKey', 'metaKey', 'shiftKey'] as const) {
    Object.defineProperty(e, k, { value: init[k] ?? (k.endsWith('Key') ? false : 0) });
  }
  target.dispatchEvent(e);
  return e;
}

function pointer(target: Element, type: string, init: PointerEventInit): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      ...init,
    }),
  );
}

function touch(target: Element, type: string, points: Array<{ clientX: number; clientY: number }>) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: points });
  target.dispatchEvent(e);
  return e;
}

function key(target: Element, k: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

function button(container: HTMLElement, kind: 'in' | 'out' | 'reset'): HTMLButtonElement {
  return container.querySelector(`.oc-map-zoom-btn[data-zoom="${kind}"]`) as HTMLButtonElement;
}

/** Map-frame point under a screen pivot for a camera (inverse of the camera transform). */
function mapPointUnder(cam: Camera, vb: { width: number; height: number }, sx: number, sy: number) {
  return { x: cam.cx + (sx - vb.width / 2) / cam.k, y: cam.cy + (sy - vb.height / 2) / cam.k };
}

// ---------------------------------------------------------------------------
// Pure camera math
// ---------------------------------------------------------------------------

describe('map zoom math', () => {
  const vb = { width: 600, height: 400 };

  it('resolveMapZoom is off unless opted in, and fills defaults', () => {
    expect(resolveMapZoom(undefined)).toBeNull();
    expect(resolveMapZoom(false)).toBeNull();
    expect(resolveMapZoom(true)).toEqual({ maxZoom: DEFAULT_MAX_ZOOM, controls: true });
    expect(resolveMapZoom({ maxZoom: 4, controls: false })).toEqual({
      maxZoom: 4,
      controls: false,
    });
    expect(resolveMapZoom({ maxZoom: 0.5 })!.maxZoom).toBe(1);
  });

  it('clampMapCamera keeps zoom in [1, max] and pins the full view to the center', () => {
    expect(clampMapCamera({ cx: 10, cy: 10, k: 0.5 }, vb, 8)).toEqual({ cx: 300, cy: 200, k: 1 });
    expect(clampMapCamera({ cx: 300, cy: 200, k: 50 }, vb, 8).k).toBe(8);
  });

  it('clampMapCamera stops panning at the map edge', () => {
    // At k=2 the view is 300x200, so its center can't get closer than 150/100 to an edge.
    expect(clampMapCamera({ cx: -500, cy: 9999, k: 2 }, vb, 8)).toEqual({ cx: 150, cy: 300, k: 2 });
    // Inside the bounds it's untouched.
    expect(clampMapCamera({ cx: 250, cy: 180, k: 2 }, vb, 8)).toEqual({ cx: 250, cy: 180, k: 2 });
  });

  it('zoomCameraAt keeps the map point under the pivot fixed', () => {
    const start = { cx: 280, cy: 190, k: 1.5 };
    const pivot = { x: 420, y: 90 };
    const before = mapPointUnder(start, vb, pivot.x, pivot.y);
    const next = zoomCameraAt(start, vb, 4, pivot.x, pivot.y);
    const after = mapPointUnder(next, vb, pivot.x, pivot.y);
    expect(next.k).toBe(4);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('panCamera moves the map with the drag, scaled by zoom', () => {
    // Dragging right by 40 screen units at k=2 shifts the view left by 20 map units.
    expect(panCamera({ cx: 300, cy: 200, k: 2 }, 40, -10)).toEqual({ cx: 280, cy: 205, k: 2 });
  });

  it('wheelZoomFactor is exponential, symmetric, and bounded', () => {
    const inF = wheelZoomFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false });
    const outF = wheelZoomFactor({ deltaY: 100, deltaMode: 0, ctrlKey: false });
    expect(inF).toBeGreaterThan(1);
    expect(inF * outF).toBeCloseTo(1, 9);
    // Trackpad pinch (ctrl + small pixel deltas) is boosted.
    expect(wheelZoomFactor({ deltaY: -4, deltaMode: 0, ctrlKey: true })).toBeGreaterThan(
      wheelZoomFactor({ deltaY: -4, deltaMode: 0, ctrlKey: false }),
    );
    // A huge delta never more than doubles or halves in one event.
    expect(wheelZoomFactor({ deltaY: -100000, deltaMode: 0, ctrlKey: false })).toBe(2);
    expect(wheelZoomFactor({ deltaY: 100000, deltaMode: 0, ctrlKey: false })).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Mounted gestures
// ---------------------------------------------------------------------------

describe('GeoMap reader zoom (geo.zoom)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('is off by default: no controls, no focus stop, wheel untouched', () => {
    const spec = zoomSpec();
    delete spec.geo.zoom;
    const inst = createGeoMap(container, spec, { responsive: false });
    expect(container.querySelector('.oc-map-zoom')).toBeNull();
    expect(container.querySelector('svg')!.hasAttribute('tabindex')).toBe(false);

    const e = wheel(container.querySelector('svg')!, {
      deltaY: -100,
      ctrlKey: true,
      ...mapCenter(inst),
    });
    expect(e.defaultPrevented).toBe(false);
    expect(inst.getCamera().k).toBe(1);
    inst.destroy();
  });

  it('renders accessible zoom buttons; out/reset start disabled', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const group = container.querySelector('.oc-map-zoom-controls')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(button(container, 'in').getAttribute('aria-label')).toBe('Zoom in');
    expect(button(container, 'out').getAttribute('aria-label')).toBe('Zoom out');
    expect(button(container, 'reset').getAttribute('aria-label')).toBe('Reset zoom');
    expect(button(container, 'in').disabled).toBe(false);
    expect(button(container, 'out').disabled).toBe(true);
    expect(button(container, 'reset').disabled).toBe(true);
    expect(container.querySelector('svg')!.getAttribute('tabindex')).toBe('0');
    inst.destroy();
  });

  it('controls: false keeps gestures but hides the buttons', () => {
    const inst = createGeoMap(container, zoomSpec({ controls: false }), { responsive: false });
    expect(container.querySelector('.oc-map-zoom-controls')).toBeNull();
    wheel(container.querySelector('svg')!, { deltaY: -100, ctrlKey: true, ...mapCenter(inst) });
    expect(inst.getCamera().k).toBeGreaterThan(1);
    inst.destroy();
  });

  it('ctrl + wheel zooms around the cursor', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const vb = inst.layout.mapSize;
    const pivot = { x: vb.width * 0.3, y: vb.height * 0.4 };
    const before = mapPointUnder(inst.getCamera(), vb, pivot.x, pivot.y);

    const e = wheel(container.querySelector('svg')!, {
      deltaY: -100,
      ctrlKey: true,
      ...clientAt(inst, pivot.x, pivot.y),
    });

    expect(e.defaultPrevented).toBe(true);
    const cam = inst.getCamera();
    expect(cam.k).toBeGreaterThan(1);
    const after = mapPointUnder(cam, vb, pivot.x, pivot.y);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    inst.destroy();
  });

  it('meta (cmd) + wheel also zooms', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    wheel(container.querySelector('svg')!, { deltaY: -100, metaKey: true, ...mapCenter(inst) });
    expect(inst.getCamera().k).toBeGreaterThan(1);
    inst.destroy();
  });

  it('a plain wheel scrolls the page and flashes the hint', () => {
    vi.useFakeTimers();
    try {
      const inst = createGeoMap(container, zoomSpec(), { responsive: false });
      const e = wheel(container.querySelector('svg')!, { deltaY: 100, ...mapCenter(inst) });
      expect(e.defaultPrevented).toBe(false);
      expect(inst.getCamera().k).toBe(1);
      const hint = container.querySelector('.oc-map-zoom-hint')!;
      expect(hint.hasAttribute('data-visible')).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(hint.hasAttribute('data-visible')).toBe(false);

      // A real zoom gesture dismisses a hint that is still up.
      wheel(container.querySelector('svg')!, { deltaY: 100, ...mapCenter(inst) });
      wheel(container.querySelector('svg')!, { deltaY: -100, ctrlKey: true, ...mapCenter(inst) });
      expect(hint.hasAttribute('data-visible')).toBe(false);
      inst.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores wheels outside the map area (chrome, legend)', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const { area } = inst.layout;
    const e = wheel(container.querySelector('svg')!, {
      deltaY: -100,
      ctrlKey: true,
      clientX: area.x + 10,
      clientY: area.y + area.height + 5,
    });
    expect(e.defaultPrevented).toBe(false);
    expect(inst.getCamera().k).toBe(1);
    inst.destroy();
  });

  it('buttons zoom in, clamp at maxZoom, zoom out, and reset (reduced motion snaps)', () => {
    mockReducedMotion();
    const inst = createGeoMap(container, zoomSpec({ maxZoom: 4 }), { responsive: false });
    button(container, 'in').click();
    expect(inst.getCamera().k).toBeCloseTo(2);
    expect(button(container, 'out').disabled).toBe(false);
    expect(button(container, 'reset').disabled).toBe(false);

    button(container, 'in').click();
    button(container, 'in').click();
    expect(inst.getCamera().k).toBeCloseTo(4);
    expect(button(container, 'in').disabled).toBe(true);

    button(container, 'out').click();
    expect(inst.getCamera().k).toBeCloseTo(2);

    button(container, 'reset').click();
    const cam = inst.getCamera();
    expect(cam.k).toBe(1);
    expect(cam.cx).toBeCloseTo(inst.layout.mapSize.width / 2);
    expect(container.querySelector('[data-oc-map-camera]')!.getAttribute('transform')).toBeNull();
    inst.destroy();
  });

  it('zoom buttons tween when motion is allowed', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    button(container, 'in').click();
    expect(raf).toHaveBeenCalled();
    inst.destroy();
  });

  it('drag pans once zoomed, stays inside the map, and swallows the click', () => {
    const onMarkClick = vi.fn();
    const inst = createGeoMap(container, zoomSpec(), { responsive: false, onMarkClick });
    inst.setCamera({ ...inst.getCamera(), k: 3 });
    const svg = container.querySelector('svg')!;
    const start = inst.getCamera();
    const c = mapCenter(inst);

    pointer(svg, 'pointerdown', c);
    pointer(svg, 'pointermove', { clientX: c.clientX + 30, clientY: c.clientY + 12 });
    const mid = inst.getCamera();
    expect(mid.cx).toBeCloseTo(start.cx - 30 / 3);
    expect(mid.cy).toBeCloseTo(start.cy - 12 / 3);
    expect(svg.classList.contains('oc-map--panning')).toBe(true);

    // A wild drag can't push the map out of frame.
    pointer(svg, 'pointermove', { clientX: c.clientX + 5000, clientY: c.clientY + 5000 });
    const vb = inst.layout.mapSize;
    const end = inst.getCamera();
    expect(end.cx).toBeCloseTo(vb.width / (2 * end.k));
    expect(end.cy).toBeCloseTo(vb.height / (2 * end.k));

    pointer(svg, 'pointerup', { clientX: c.clientX + 5000, clientY: c.clientY + 5000 });
    expect(svg.classList.contains('oc-map--panning')).toBe(false);
    container
      .querySelector('.oc-map-point')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onMarkClick).not.toHaveBeenCalled();
    inst.destroy();
  });

  it('a press without movement is still a click', () => {
    const onMarkClick = vi.fn();
    const inst = createGeoMap(container, zoomSpec(), { responsive: false, onMarkClick });
    inst.setCamera({ ...inst.getCamera(), k: 3 });
    const svg = container.querySelector('svg')!;
    const c = mapCenter(inst);
    pointer(svg, 'pointerdown', c);
    pointer(svg, 'pointerup', c);
    container
      .querySelector('.oc-map-point')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onMarkClick).toHaveBeenCalledOnce();
    inst.destroy();
  });

  it('blocks text selection for map presses that can become a drag or double-click', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const svg = container.querySelector('svg')!;
    const c = mapCenter(inst);
    const down = (detail: number) => {
      const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail, ...c });
      svg.dispatchEvent(e);
      return e.defaultPrevented;
    };
    // Full view, single press: nothing to drag, leave the default alone.
    expect(down(1)).toBe(false);
    // Second press of a double-click selects a word by default.
    expect(down(2)).toBe(true);
    inst.setCamera({ ...inst.getCamera(), k: 2 });
    expect(down(1)).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('svg'));
    inst.destroy();
  });

  it('drag does nothing at the full view', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const svg = container.querySelector('svg')!;
    const c = mapCenter(inst);
    pointer(svg, 'pointerdown', c);
    pointer(svg, 'pointermove', { clientX: c.clientX + 50, clientY: c.clientY });
    expect(inst.getCamera().cx).toBeCloseTo(inst.layout.mapSize.width / 2);
    expect(svg.classList.contains('oc-map--panning')).toBe(false);
    inst.destroy();
  });

  it('double-click zooms in 2x at the cursor; shift + double-click zooms out', () => {
    mockReducedMotion();
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true, ...mapCenter(inst) }),
    );
    expect(inst.getCamera().k).toBeCloseTo(2);
    svg.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        shiftKey: true,
        ...mapCenter(inst),
      }),
    );
    expect(inst.getCamera().k).toBeCloseTo(1);
    inst.destroy();
  });

  it('keyboard: + zooms, arrows pan, 0 resets; arrows at full view scroll the page', () => {
    mockReducedMotion();
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const svg = container.querySelector('svg')!;
    svg.focus();

    expect(key(svg, 'ArrowRight').defaultPrevented).toBe(false);

    expect(key(svg, '+').defaultPrevented).toBe(true);
    expect(inst.getCamera().k).toBeCloseTo(2);

    const before = inst.getCamera();
    key(svg, 'ArrowRight');
    expect(inst.getCamera().cx).toBeGreaterThan(before.cx);
    key(svg, 'ArrowUp');
    expect(inst.getCamera().cy).toBeLessThan(before.cy);

    key(svg, '-');
    expect(inst.getCamera().k).toBeCloseTo(1);
    key(svg, '=');
    key(svg, '0');
    expect(inst.getCamera().k).toBe(1);
    inst.destroy();
  });

  it('touch: pinch zooms; one finger scrolls the page until zoomed, then pans', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const svg = container.querySelector('svg')!;
    const c = mapCenter(inst);
    expect((svg as SVGSVGElement & ElementCSSInlineStyle).style.touchAction).toBe('pan-x pan-y');

    // One finger at the full view: not claimed, camera untouched.
    const t0 = touch(svg, 'touchstart', [c]);
    const m0 = touch(svg, 'touchmove', [{ clientX: c.clientX, clientY: c.clientY - 40 }]);
    touch(svg, 'touchend', []);
    expect(t0.defaultPrevented).toBe(false);
    expect(m0.defaultPrevented).toBe(false);
    expect(inst.getCamera().k).toBe(1);

    // Two fingers spreading apart: zoom in.
    const a = { clientX: c.clientX - 20, clientY: c.clientY };
    const b = { clientX: c.clientX + 20, clientY: c.clientY };
    const ps = touch(svg, 'touchstart', [a, b]);
    expect(ps.defaultPrevented).toBe(true);
    touch(svg, 'touchmove', [
      { clientX: c.clientX - 60, clientY: c.clientY },
      { clientX: c.clientX + 60, clientY: c.clientY },
    ]);
    touch(svg, 'touchend', []);
    expect(inst.getCamera().k).toBeCloseTo(3);
    expect((svg as SVGSVGElement & ElementCSSInlineStyle).style.touchAction).toBe('none');

    // Now one finger pans.
    const before = inst.getCamera();
    touch(svg, 'touchstart', [c]);
    touch(svg, 'touchmove', [{ clientX: c.clientX + 30, clientY: c.clientY }]);
    touch(svg, 'touchend', []);
    expect(inst.getCamera().cx).toBeCloseTo(before.cx - 30 / before.k);
    inst.destroy();
  });

  it('points keep their screen radius and still show tooltips while zoomed', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    wheel(container.querySelector('svg')!, { deltaY: -300, ctrlKey: true, ...mapCenter(inst) });
    const k = inst.getCamera().k;
    expect(k).toBeGreaterThan(1);

    const point = container.querySelector('.oc-map-point')!;
    const baseR = Number(point.getAttribute('data-base-r'));
    expect(Number(point.getAttribute('r'))).toBeCloseTo(baseR / k);
    for (const f of container.querySelectorAll('.oc-map-feature')) {
      expect(f.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    }

    point.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, clientX: 50, clientY: 50 }));
    const tip = container.querySelector('.oc-tooltip') as HTMLElement | null;
    expect(tip?.textContent).toMatch(/LA|NYC/);
    inst.destroy();
  });

  it('clips the map to its frame only while zoomed', () => {
    mockReducedMotion();
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const group = () => container.querySelector('.oc-map-group')!;
    expect(group().hasAttribute('clip-path')).toBe(false);
    button(container, 'in').click();
    const ref = group().getAttribute('clip-path')!;
    expect(ref).toMatch(/^url\(#oc-map-zoom-clip-\d+\)$/);
    expect(container.querySelector(ref.slice(4, -1))).not.toBeNull();
    button(container, 'reset').click();
    expect(group().hasAttribute('clip-path')).toBe(false);
    inst.destroy();
  });

  it('gestures and the imperative API share one camera, reported via onCameraChange', () => {
    const onCameraChange = vi.fn();
    const inst = createGeoMap(container, zoomSpec(), { responsive: false, onCameraChange });

    inst.zoomTo('36', { duration: 0 });
    const focused = inst.getCamera();
    expect(onCameraChange).toHaveBeenLastCalledWith(focused);

    // The wheel continues from the zoomTo camera rather than a stale one.
    wheel(container.querySelector('svg')!, { deltaY: -100, ctrlKey: true, ...mapCenter(inst) });
    const after = inst.getCamera();
    expect(after.k).toBeGreaterThan(Math.min(focused.k, DEFAULT_MAX_ZOOM) - 1e-6);
    expect(onCameraChange).toHaveBeenLastCalledWith(after);

    inst.setCamera({ cx: 100, cy: 100, k: 2 });
    expect(onCameraChange).toHaveBeenLastCalledWith({ cx: 100, cy: 100, k: 2 });
    inst.destroy();
  });

  it('keeps the reader view across a data update and survives re-render focus', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    const svg = container.querySelector('svg')!;
    svg.focus();
    wheel(svg, { deltaY: -200, ctrlKey: true, ...mapCenter(inst) });
    const cam = inst.getCamera();

    const next = zoomSpec();
    next.points!.data = [{ lat: 34, lon: -118, name: 'LA', value: 300 }];
    inst.update(next);

    expect(inst.getCamera()).toEqual(cam);
    const newSvg = container.querySelector('svg')!;
    expect(newSvg).not.toBe(svg);
    expect(document.activeElement).toBe(newSvg);
    expect(container.querySelector('[data-oc-map-camera]')!.getAttribute('transform')).toContain(
      `scale(${cam.k})`,
    );
    inst.destroy();
  });

  it('destroy removes the overlay and listeners', () => {
    const inst = createGeoMap(container, zoomSpec(), { responsive: false });
    inst.destroy();
    expect(container.querySelector('.oc-map-zoom')).toBeNull();
    const e = wheel(container, { deltaY: -100, ctrlKey: true, clientX: 300, clientY: 200 });
    expect(e.defaultPrevented).toBe(false);
  });
});
