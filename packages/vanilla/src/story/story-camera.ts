/**
 * Applies the scrollytelling camera transform to a mounted chart's marks
 * group (`[data-oc-marks-group]`, stamped by svg-renderer.ts). Re-finds the
 * group on every apply since `ChartInstance.update()` tears down and
 * rebuilds the SVG on every render -- the previous group reference goes
 * stale the instant a step patch triggers a re-render.
 *
 * DO NOT USE THIS TO "ZOOM IN" ON A CARTESIAN CHART.
 *
 * This is a geometric magnification of the marks group and nothing else. The
 * axes, gridlines, and annotations are siblings of that group, so they do not
 * move: zoom a line chart to 2010-2020 and the lines blow up while the x-axis
 * still reads 2000-2020 and every annotation drifts off its data point. Stroke
 * widths scale with the transform too, so the lines visibly fatten. The chart
 * ends up misrepresenting its own axis.
 *
 * To zoom a cartesian chart, narrow the scale domain instead and let the engine
 * recompile:
 *
 *   { spec: { encoding: { x: { scale: { domain: ['2019', ...], clip: true } } } } }
 *
 * That relabels the axis, re-anchors annotations, keeps stroke widths constant,
 * and still morphs (the field identity is unchanged, so `canTransitionSpecShape`
 * passes and the marks FLIP-tween into the new scale).
 *
 * The camera remains useful where there is no axis to contradict -- graph and
 * other non-cartesian views, where magnifying the geometry IS the intent.
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
