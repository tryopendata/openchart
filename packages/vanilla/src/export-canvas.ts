/**
 * Exports for charts rendered in canvas mark mode.
 *
 * On screen, canvas mode splits the figure across two surfaces: a `<canvas>`
 * painting background, gridlines and dots, and an SVG carrying axes, trendline,
 * annotations and chrome. Serializing the SVG alone would export a chart with
 * no data in it, so every format has to re-materialize the missing half.
 *
 * Two strategies, chosen by point count:
 *
 * - **Vector** (at or below `VECTOR_EXPORT_MAX_POINTS`): re-render the layout
 *   as if canvas mode had never been asked for. `renderChartSVG` keys ONLY on
 *   `opts.canvasMarks`, never on `layout.markRenderMode`, so simply omitting
 *   the option yields a full-fidelity SVG by construction -- true gradients,
 *   vector gridlines, real background rect, one `<circle>` per dot. Pixel-
 *   identical to what an SVG-mode chart of the same spec exports.
 *
 * - **Raster marks** (above it): keep the SVG vector for everything except the
 *   dots, and inline one canvas pass of the marks as an `<image>`. 50,000
 *   `<circle>` elements is not a file anyone wants; the gridlines, axes and
 *   text stay crisp and only the dot cloud rasterizes.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';
import { ScatterCanvasRenderer } from './scatter-canvas/renderer';
import { buildScatterCanvasState } from './scatter-canvas/state';
import { renderChartSVG } from './svg-renderer';

/**
 * Point count above which SVG/PNG export inlines the marks as a raster
 * `<image>` instead of emitting one `<circle>` each.
 *
 * A judgment cap. Below it the per-element cost is worth full vector fidelity;
 * above it the file size and the consuming editor's patience are not.
 */
export const VECTOR_EXPORT_MAX_POINTS = 5000;

/** Device pixel ratio for the offscreen mark raster. */
const RASTER_DPR = 2;

/** Count the point marks in a layout. */
function pointCount(layout: ChartLayout): number {
  let n = 0;
  for (const mark of layout.marks) {
    if (mark.type === 'point') n++;
  }
  return n;
}

/**
 * Render `layout` to a detached SVG exactly as SVG mode would.
 *
 * Detached rendering is safe here: `renderChartSVG` takes no measurements off
 * the live document, its generated ids come from a monotonic module counter, and
 * it injects nothing into `<head>`. The container is never inserted, so this
 * costs one render and no layout.
 */
function materializeSvgModeSVG(layout: ChartLayout): SVGElement {
  const host = document.createElement('div');
  // No `canvasMarks` option: the renderer emits the full SVG -- background,
  // gridlines and every point circle.
  return renderChartSVG(layout, host, { animate: false });
}

/**
 * Render `layout` with vector everything-but-the-dots, and the dots inlined as
 * a single raster `<image>`.
 *
 * The image goes in as the FIRST child of the clipped marks group, so it lands
 * under the trendline and any overlays -- matching the on-screen stack, where
 * the canvas sits below the SVG.
 */
function materializeRasterMarkSVG(layout: ChartLayout): SVGElement {
  const host = document.createElement('div');
  // Full SVG first, then strip the circles. NOT `canvasMarks: true`: that
  // option also suppresses the background rect and the gridlines, and this
  // path wants both of those in vector -- only the dot cloud rasterizes.
  const svg = renderChartSVG(layout, host, { animate: false });

  const dataUrl = rasterizeMarks(layout);
  // No raster available (no 2D context, no toDataURL): keep the vector circles
  // rather than shipping an empty plot. A large file beats a blank chart.
  if (!dataUrl) {
    console.warn(
      '[viz] Canvas raster export unavailable in this environment; exporting all points as vector SVG (larger file).',
    );
    return svg;
  }

  for (const circle of svg.querySelectorAll('circle.oc-mark-point')) {
    circle.remove();
  }

  const { width, height } = layout.dimensions;
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));
  image.setAttribute('href', dataUrl);
  // Older consumers (some editors, librsvg) only honor the namespaced form.
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl);
  image.setAttribute('aria-hidden', 'true');

  const marksGroup = svg.querySelector('[data-oc-marks-group]');
  if (marksGroup) marksGroup.insertBefore(image, marksGroup.firstChild);
  return svg;
}

/**
 * Paint just the marks to an offscreen canvas and return a data URL.
 *
 * Background and gridlines are stripped from the state rather than skipped in
 * the renderer: the SVG already draws both as vector, and painting them again
 * underneath would double the gridline strokes and hide the vector background.
 *
 * Returns `null` when the environment cannot produce a raster (no 2D context,
 * no `toDataURL`), so the caller falls back to a marks-free SVG rather than
 * throwing. A chart missing its dots beats an export that crashes.
 */
function rasterizeMarks(layout: ChartLayout): string | null {
  const { width, height } = layout.dimensions;
  const canvas = document.createElement('canvas');

  const state = buildScatterCanvasState(layout);
  // Marks only: the SVG underneath already carries a vector background and
  // vector gridlines, and painting them again here would double them up.
  // Blank rather than 'transparent' -- the renderer skips the background on a
  // falsy value, so this holds for any theme, including one whose background
  // resolves to 'none' or an alpha-zero rgba() that is truthy but invisible.
  state.background = '';
  state.gridlines = [];

  const renderer = new ScatterCanvasRenderer(canvas, RASTER_DPR);
  renderer.resize(width, height);
  renderer.render(state);

  if (typeof canvas.toDataURL !== 'function') return null;
  try {
    return canvas.toDataURL('image/png');
  } catch {
    // Tainted canvas, or a stub that only pretends to implement the API.
    return null;
  }
}

/**
 * Materialize a canvas-mode layout into a single self-contained SVG element.
 *
 * This is what every export format consumes: SVG serializes it directly, and
 * PNG/JPG/GIF rasterize it. Raster formats always take the vector path
 * regardless of point count -- they are becoming pixels anyway, so the one-shot
 * cost of the full SVG buys pixel-parity with SVG mode for free.
 *
 * This is also why the GIF path needs no canvas compositing. Handing the
 * encoder a complete SVG means the existing frame pipeline works unchanged: no
 * per-frame `drawImage` of the live mark canvas, no background sourced from a
 * suppressed rect, no second code path to keep in sync with the first.
 */
export function materializeCanvasModeSVG(
  layout: ChartLayout,
  opts?: { forceVector?: boolean },
): SVGElement {
  if (opts?.forceVector || pointCount(layout) <= VECTOR_EXPORT_MAX_POINTS) {
    return materializeSvgModeSVG(layout);
  }
  return materializeRasterMarkSVG(layout);
}
