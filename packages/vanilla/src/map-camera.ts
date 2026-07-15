/**
 * Map camera utilities: zoom, pan, and focus for map visualizations.
 *
 * Reuses the existing camera-math infrastructure from the scrollytelling
 * system. The camera transform is applied as an SVG `transform` attribute
 * on the `[data-oc-map-camera]` group, never as a CSS transform.
 */

import type { MapLayout } from '@opendata-ai/openchart-core';
import type { Camera, CameraTarget } from './story/camera-math';
import { cameraTransform, FULL_VIEW, fitTarget } from './story/camera-math';

export type { Camera } from './story/camera-math';

export interface MapCameraOptions {
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
  layout: MapLayout,
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
export function cameraForTarget(layout: MapLayout, target?: CameraTarget | null): Camera {
  const vb = layout.mapSize;
  if (!target) return fitTarget(FULL_VIEW(vb), vb);
  const cam = fitTarget(target, vb);
  return { ...cam, k: Math.max(1, Math.min(40, cam.k)) };
}

/**
 * Apply a camera transform to the map's camera group.
 * Toggles vector-effect="non-scaling-stroke" on features/borders while zoomed.
 */
export function applyMapCamera(svg: SVGElement, camera: Camera, layout: MapLayout): void {
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
    // Counter-scale point radii so dots keep constant screen size through zoom
    const points = svg.querySelectorAll('.oc-map-point');
    for (const p of points) {
      const baseR = Number(p.getAttribute('data-base-r') ?? 5);
      const baseSW = Number(p.getAttribute('data-base-stroke-width') ?? 1);
      p.setAttribute('r', String(baseR / camera.k));
      p.setAttribute('stroke-width', String(baseSW / camera.k));
      p.setAttribute('vector-effect', 'non-scaling-stroke');
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
