/**
 * Map camera utilities: zoom, pan, and focus for map visualizations.
 *
 * Reuses the existing camera-math infrastructure from the scrollytelling
 * system. The camera transform is applied as an SVG `transform` attribute
 * on the `[data-oc-map-camera]` group, never as a CSS transform.
 */

import type { GeoMapLayout, GeoMapZoomConfig } from '@opendata-ai/openchart-core';
import type { Camera, CameraTarget, ViewBoxSize } from './story/camera-math';
import { cameraTransform, FULL_VIEW, fitTarget } from './story/camera-math';

export type { Camera } from './story/camera-math';

/** Resting opacity for features outside the current focus set. */
export const FOCUS_DIM_OPACITY = 0.25;

export interface GeoMapCameraOptions {
  /** Transition duration in ms. 0 snaps instantly. Default 600. */
  duration?: number;
  /** Padding in map-local units around the target. Default 16. */
  padding?: number;
}

/**
 * Compute a CameraTarget from the union of feature bounds.
 * Returns null if no matching features found.
 */
export function focusTargetForFeatures(
  layout: GeoMapLayout,
  ids: Array<string | number>,
  padding = 16,
): CameraTarget | null {
  const idSet = new Set(ids.map(String));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const f of layout.features) {
    if (idSet.has(String(f.id))) {
      found = true;
      minX = Math.min(minX, f.bounds.x);
      minY = Math.min(minY, f.bounds.y);
      maxX = Math.max(maxX, f.bounds.x + f.bounds.width);
      maxY = Math.max(maxY, f.bounds.y + f.bounds.height);
    }
  }

  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, padding };
}

/**
 * Compute the Camera for a target, fitting against mapSize.
 * Returns the full-view camera if no target provided.
 */
export function cameraForTarget(layout: GeoMapLayout, target?: CameraTarget | null): Camera {
  const vb = layout.mapSize;
  if (!target) return fitTarget(FULL_VIEW(vb), vb);
  const cam = fitTarget(target, vb);
  return { ...cam, k: Math.max(1, Math.min(40, cam.k)) };
}

// ---------------------------------------------------------------------------
// Reader zoom/pan math (geo.zoom)
// ---------------------------------------------------------------------------

/** Default zoom ceiling for reader zoom, as a multiple of the full map. */
export const DEFAULT_MAX_ZOOM = 12;

/** Resolved `geo.zoom` config. */
export interface ResolvedMapZoom {
  maxZoom: number;
  controls: boolean;
}

/** Resolve `geo.zoom` to a config, or null when reader zoom is off. */
export function resolveMapZoom(
  zoom: GeoMapZoomConfig | boolean | undefined,
): ResolvedMapZoom | null {
  if (!zoom) return null;
  const cfg = zoom === true ? {} : zoom;
  const max = cfg.maxZoom;
  return {
    maxZoom: typeof max === 'number' && Number.isFinite(max) ? Math.max(1, max) : DEFAULT_MAX_ZOOM,
    controls: cfg.controls !== false,
  };
}

/**
 * Clamp a camera for reader navigation: zoom stays in [1, maxZoom] and the
 * view window (mapSize / k, centered on cx/cy) never leaves the map, so the
 * reader can't pan the map out of its frame. At k = 1 this pins the center.
 */
export function clampMapCamera(camera: Camera, vb: ViewBoxSize, maxZoom: number): Camera {
  const k = Math.min(Math.max(camera.k, 1), Math.max(1, maxZoom));
  const halfW = vb.width / (2 * k);
  const halfH = vb.height / (2 * k);
  return {
    cx: Math.min(Math.max(camera.cx, halfW), vb.width - halfW),
    cy: Math.min(Math.max(camera.cy, halfH), vb.height - halfH),
    k,
  };
}

/**
 * Zoom to `k` keeping the map point under a pivot fixed on screen. The pivot
 * is in map-frame units (0..mapSize, before the camera transform), the same
 * space the cursor lands in. Mirrors graph `ZoomTransform.zoomAt` for the
 * center-based camera: the point under the pivot is c + (s - vb/2) / k.
 */
export function zoomCameraAt(
  camera: Camera,
  vb: ViewBoxSize,
  k: number,
  pivotX: number,
  pivotY: number,
): Camera {
  const ox = pivotX - vb.width / 2;
  const oy = pivotY - vb.height / 2;
  const px = camera.cx + ox / camera.k;
  const py = camera.cy + oy / camera.k;
  return { cx: px - ox / k, cy: py - oy / k, k };
}

/** Pan by a screen delta in map-frame units (drag right moves the map right). */
export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { cx: camera.cx - dx / camera.k, cy: camera.cy - dy / camera.k, k: camera.k };
}

/**
 * Multiplicative zoom step for a wheel event, d3-zoom style: exponential so a
 * notch in and a notch out cancel. Trackpad pinch arrives as ctrl + small
 * pixel deltas, which get a boost so a pinch feels as fast as the wheel.
 */
export function wheelZoomFactor(e: Pick<WheelEvent, 'deltaY' | 'deltaMode' | 'ctrlKey'>): number {
  const perUnit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002;
  let exp = -e.deltaY * perUnit;
  if (e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaY) < 50) exp *= 5;
  return 2 ** Math.max(-1, Math.min(1, exp));
}

/**
 * Apply a camera transform to the map's camera group.
 * Toggles vector-effect="non-scaling-stroke" on features/borders while zoomed.
 */
export function applyMapCamera(svg: SVGElement, camera: Camera, layout: GeoMapLayout): void {
  const cameraGroup = svg.querySelector('[data-oc-map-camera]');
  if (!cameraGroup) return;

  const vb = layout.mapSize;
  const isZoomed = Math.abs(camera.k - 1) > 1e-3;

  if (isZoomed) {
    cameraGroup.setAttribute('transform', cameraTransform(camera, vb));
    // Toggle non-scaling-stroke so strokes don't fatten when zoomed
    const paths = svg.querySelectorAll('.oc-map-feature, .oc-map-borders path');
    for (const p of paths) {
      p.setAttribute('vector-effect', 'non-scaling-stroke');
    }
    // Counter-scale point radii so dots keep constant screen size through zoom.
    // Only use attribute counter-scaling (r/k, stroke-width/k) without
    // vector-effect: the group transform scales both back to constant screen
    // size. Adding vector-effect on top would double-compensate stroke.
    const points = svg.querySelectorAll('.oc-map-point');
    for (const p of points) {
      const baseR = Number(p.getAttribute('data-base-r') ?? 5);
      const baseSW = Number(p.getAttribute('data-base-stroke-width') ?? 1);
      p.setAttribute('r', String(baseR / camera.k));
      p.setAttribute('stroke-width', String(baseSW / camera.k));
    }
  } else {
    cameraGroup.removeAttribute('transform');
    const paths = svg.querySelectorAll('.oc-map-feature, .oc-map-borders path');
    for (const p of paths) {
      p.removeAttribute('vector-effect');
    }
    // Reset point radii when not zoomed
    const points = svg.querySelectorAll('.oc-map-point');
    for (const p of points) {
      const baseR = Number(p.getAttribute('data-base-r') ?? 5);
      const baseSW = Number(p.getAttribute('data-base-stroke-width') ?? 1);
      p.setAttribute('r', String(baseR));
      p.setAttribute('stroke-width', String(baseSW));
      p.removeAttribute('vector-effect');
    }
  }
}
