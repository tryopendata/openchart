/**
 * Rect mark renderer (heatmap cells).
 *
 * The Vega-Lite `rect` mark: one cell per row, positioned by x and y, colored
 * by the `color` channel. The canonical use is a two-way heatmap (nominal x
 * nominal, quantitative color), which is what this renderer is built for.
 *
 * `rect` used to alias `columnRenderer`, which hard-requires a band x-scale and
 * a *linear* y-scale (it anchors every cell to `yScale(0)`). A heatmap has a
 * band scale on both axes, so `columnRenderer` bailed at its bandwidth guard and
 * emitted nothing: `mark: 'rect'` rendered a blank chart, with no error.
 *
 * Not to be confused with `RectMark`, the layout primitive that columns, waffle
 * cells, calendar cells, and dot stems all emit. That was never broken; only the
 * spec-level `mark: 'rect'` was.
 */

import type { Encoding, Mark, MarkAria, Rect, RectMark } from '@opendata-ai/openchart-core';
import { formatNumber } from '@opendata-ai/openchart-core';
import type { ScaleBand } from 'd3-scale';

import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import type { ChartRenderer } from '../registry';
import { getColor, getSequentialColor, scaleValue } from '../utils';

/**
 * Cell extent along one axis. `resolveScale` gives `rect` a band scale on both
 * axes (see the `chartType === 'rect'` branch in layout/scales.ts), so the
 * bandwidth *is* the cell size. A non-band scale means a quantitative axis,
 * which would need binning to have a cell width at all: return 0 so the caller
 * can bail rather than emit degenerate zero-area cells.
 */
function bandwidthOf(scale: ResolvedScales['x']): number {
  const band = scale?.scale as Partial<ScaleBand<string>> | undefined;
  return typeof band?.bandwidth === 'function' ? band.bandwidth() : 0;
}

/**
 * Compute rect (heatmap cell) marks from a normalized spec and resolved scales.
 *
 * Both axes are band scales, so a cell's x/y is the scaled value directly (a
 * band places the cell's leading corner there) and its size is the bandwidth.
 */
export function computeRectMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
): RectMark[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const yChannel = encoding.y;

  if (!xChannel || !yChannel || !scales.x || !scales.y) return [];

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const isSequential = colorEnc?.type === 'quantitative';

  const cellWidth = bandwidthOf(scales.x);
  const cellHeight = bandwidthOf(scales.y);
  // A quantitative axis yields no bandwidth. Cells would be zero-area and
  // invisible, so emit nothing rather than pretend: `rect` wants two
  // categorical axes (bin the field first to heatmap a continuous one).
  if (cellWidth <= 0 || cellHeight <= 0) return [];

  const marks: RectMark[] = [];

  for (const row of spec.data) {
    const xVal = scaleValue(scales.x.scale, scales.x.type, row[xChannel.field]);
    const yVal = scaleValue(scales.y.scale, scales.y.type, row[yChannel.field]);
    if (xVal == null || yVal == null) continue;

    // A quantitative color channel drives a sequential/binned ramp (the heatmap
    // case); a nominal one picks a categorical swatch.
    let fill: RectMark['fill'];
    if (colorEnc && isSequential) {
      const value = Number(row[colorEnc.field]);
      if (!Number.isFinite(value)) continue;
      fill = getSequentialColor(scales, value);
    } else if (colorEnc) {
      fill = getColor(scales, String(row[colorEnc.field] ?? '__default__'));
    } else {
      fill = getColor(scales, '__default__');
    }

    const colorValue = colorEnc ? row[colorEnc.field] : undefined;
    const colorLabel =
      colorEnc && colorValue != null
        ? `, ${colorEnc.field}: ${
            typeof colorValue === 'number' ? formatNumber(colorValue) : String(colorValue)
          }`
        : '';
    const aria: MarkAria = {
      label: `${row[xChannel.field]}, ${row[yChannel.field]}${colorLabel}`,
    };

    marks.push({
      type: 'rect',
      x: xVal,
      y: yVal,
      width: cellWidth,
      height: cellHeight,
      fill,
      data: row as Record<string, unknown>,
      aria,
    });
  }

  // Key on the cell's coordinates: the x/y pair is what identifies a cell across
  // a data update, which is what the transition driver matches on.
  const rawKeys = marks.map(
    (m) =>
      `${serializeKeyValue(m.data[xChannel.field])}|${serializeKeyValue(m.data[yChannel.field])}`,
  );
  const keys = dedupeKeys(rawKeys);
  for (let i = 0; i < marks.length; i++) {
    marks[i].key = keys[i];
  }

  return marks;
}

/** Rect (heatmap) chart renderer. */
export const rectRenderer: ChartRenderer = (spec, scales, chartArea, _strategy, _theme) => {
  return computeRectMarks(spec, scales, chartArea) as Mark[];
};
