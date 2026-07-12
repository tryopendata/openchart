/**
 * Applies the scrollytelling camera transform to a mounted chart's marks
 * group (`[data-oc-marks-group]`, stamped by svg-renderer.ts). Re-finds the
 * group on every apply since `ChartInstance.update()` tears down and
 * rebuilds the SVG on every render -- the previous group reference goes
 * stale the instant a step patch triggers a re-render.
 */

import { type Camera, cameraTransform, FULL_VIEW, type ViewBoxSize } from './camera-math';

/** Read the current SVG's viewBox as a `ViewBoxSize`, or null if not yet rendered. */
export function readViewBox(container: HTMLElement): ViewBoxSize | null {
  const svg = container.querySelector('svg');
  const viewBoxAttr = svg?.getAttribute('viewBox');
  if (!viewBoxAttr) return null;
  const parts = viewBoxAttr.split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return { width: parts[2]!, height: parts[3]! };
}

/** Apply a camera transform to the current marks group, if the chart is rendered. */
export function applyStoryCamera(container: HTMLElement, camera: Camera, vb: ViewBoxSize): void {
  const marksGroup = container.querySelector('[data-oc-marks-group]');
  if (!marksGroup) return;
  marksGroup.setAttribute('transform', cameraTransform(camera, vb));
}

export { FULL_VIEW };
