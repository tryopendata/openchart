/**
 * Build the canvas render state from a compiled ChartLayout.
 *
 * The canvas is sized to the FULL figure, not `layout.area`, so canvas
 * coordinates equal layout coordinates and the layer can paint the theme
 * background full-bleed. Everything the renderer needs is resolved here once
 * per layout; the render loop reads only typed arrays.
 */

import type { AxisLayout, ChartLayout, GradientDef, PointMark } from '@opendata-ai/openchart-core';
import type { CanvasGridline, CanvasRect, ScatterCanvasState, ScatterPointsSoA } from './types';

/**
 * Reduce a fill to a single solid color for canvas painting.
 *
 * Gradients flatten to their FIRST stop. Canvas could paint a real
 * `createLinearGradient`, but per-mark gradient objects would break the
 * fill-color batching that makes this layer fast, and scatter gradients are
 * near-uniform at point scale. Exports render true gradients by materializing
 * an SVG-mode render instead (a later stage), so the flattening is screen-only.
 */
export function flattenFill(fill: string | GradientDef): string {
  if (typeof fill === 'string') return fill;
  return fill.stops[0]?.color ?? 'none';
}

/** Collect gridlines from one axis into canvas-space records. */
function collectGridlines(
  axis: AxisLayout | undefined,
  orient: 'x' | 'y',
  out: CanvasGridline[],
): void {
  if (!axis) return;
  // Mirrors renderers/axes.ts: a right-side y-axis renders no gridlines (the
  // left axis already supplies them).
  if (orient === 'y' && axis.orient === 'right') return;
  for (const gridline of axis.gridlines) {
    out.push({ orient, position: gridline.position, alpha: GRIDLINE_ALPHA });
  }
}

/** Matches the SVG renderer's `stroke-opacity` on `.oc-gridline`. */
const GRIDLINE_ALPHA = 0.6;

/** Matches the SVG renderer's `stroke-width` on `.oc-gridline`. */
const GRIDLINE_WIDTH = 1;

/**
 * Compute the mark clip rect. Byte-for-byte the same formula as
 * `svg-renderer.ts` so the canvas and SVG layers clip identically: full figure
 * width, vertically padded by the largest point radius (min 2px).
 */
export function computeClipRect(layout: ChartLayout): CanvasRect {
  const maxPointR = layout.marks.reduce(
    (max, m) => (m.type === 'point' && m.r ? Math.max(max, m.r) : max),
    0,
  );
  const clipPad = Math.max(maxPointR, 2);
  return {
    x: 0,
    y: layout.area.y - clipPad,
    width: layout.dimensions.width,
    height: layout.area.height + clipPad * 2,
  };
}

/** Pack every point mark in the layout into a struct-of-arrays. */
export function buildPointsSoA(layout: ChartLayout): ScatterPointsSoA {
  // Two passes: the first counts so every typed array is allocated exactly once.
  const points: { mark: PointMark; markId: string }[] = [];
  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    if (mark.type !== 'point') continue;
    // `point-${i}` keys off the ORIGINAL marks index — tooltip descriptors and
    // chart-event payloads are built the same way (see interactions/chart-events).
    points.push({ mark, markId: `point-${i}` });
  }

  const n = points.length;
  const soa: ScatterPointsSoA = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    r: new Float32Array(n),
    fill: new Array<string>(n),
    fillOpacity: new Float32Array(n),
    stroke: new Array<string>(n),
    strokeWidth: new Float32Array(n),
    keys: new Array<string | undefined>(n),
    markIds: new Array<string>(n),
    animationIndex: new Uint32Array(n),
    data: new Array<unknown>(n),
  };

  for (let j = 0; j < n; j++) {
    const { mark, markId } = points[j];
    soa.x[j] = mark.cx;
    soa.y[j] = mark.cy;
    soa.r[j] = mark.r;
    soa.fill[j] = flattenFill(mark.fill);
    soa.fillOpacity[j] = mark.fillOpacity ?? 1;
    soa.stroke[j] = mark.stroke ?? '';
    soa.strokeWidth[j] = mark.strokeWidth ?? 0;
    soa.keys[j] = mark.key;
    soa.markIds[j] = markId;
    soa.animationIndex[j] = mark.animationIndex ?? 0;
    soa.data[j] = mark.data;
  }

  return soa;
}

/** Build the full canvas render state for a layout. */
export function buildScatterCanvasState(layout: ChartLayout): ScatterCanvasState {
  const gridlines: CanvasGridline[] = [];
  collectGridlines(layout.axes.y, 'y', gridlines);
  collectGridlines(layout.axes.y2, 'y', gridlines);
  collectGridlines(layout.axes.x, 'x', gridlines);

  return {
    width: layout.dimensions.width,
    height: layout.dimensions.height,
    clipRect: computeClipRect(layout),
    background: layout.theme.colors.background,
    marks: buildPointsSoA(layout),
    gridlines,
    gridlineStroke: layout.theme.colors.gridline,
    gridlineWidth: GRIDLINE_WIDTH,
    plotRect: {
      x: layout.area.x,
      y: layout.area.y,
      width: layout.area.width,
      height: layout.area.height,
    },
    accent: layout.theme.colors.categorical[0] ?? layout.theme.colors.text,
    enterAlpha: null,
    exiting: null,
    hoverIndex: -1,
  };
}
