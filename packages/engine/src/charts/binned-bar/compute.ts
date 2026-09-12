/**
 * Binned bar (histogram) mark computation.
 *
 * The one thing that separates this from `computeColumnMarks`: bar width comes
 * from two bin edges mapped through a *linear* x scale, not from a band scale's
 * bandwidth. That single difference is why this is a sibling module rather than
 * a fifth branch inside the column renderer, which assumes `xScale.bandwidth()`
 * everywhere.
 *
 * Grouping also differs, deliberately. On a band axis a color field means
 * "stack these", because the categories are the subject. On a binned continuous
 * axis the *distribution shape* is the subject, so a color field means ggplot's
 * `position = "identity"`: both groups occupy the same bins, drawn translucent
 * so each stays readable through the other. `stack: true` opts back into
 * stacking.
 */

import type {
  DataRow,
  Encoding,
  LayoutStrategy,
  MarkAria,
  Rect,
  RectMark,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { formatNumber } from '@opendata-ai/openchart-core';
import type { ScaleLinear } from 'd3-scale';

import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, groupByField, stackSeamStroke } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fill opacity applied to every group when more than one distribution shares
 * the bins. Two fills at 0.55 composite to roughly 0.80, which stays clearly
 * separable from either fill alone.
 */
export const OVERLAP_FILL_OPACITY = 0.55;

/**
 * Pixel gutter between adjacent bins. Wide enough that neighbouring bars read
 * as separate bars, narrow enough that the distribution still reads as one
 * continuous mass.
 */
const BIN_GAP = 1;

/** Floor so a very narrow bin still paints something. */
const MIN_BIN_WIDTH = 1;

/** Floor so a bin holding one observation is still visible. */
const MIN_BAR_HEIGHT = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute binned bar (histogram) marks from a normalized chart spec.
 *
 * Expects a quantitative x with a matching x2 (the bin's two edges) and a
 * quantitative y (the count, or a proportion). `resolveRendererKey` guarantees
 * that shape before dispatching here.
 */
export function computeBinnedBarMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
  _strategy: LayoutStrategy,
  theme?: ResolvedTheme,
): RectMark[] {
  const encoding = spec.encoding as Encoding;
  const xChannel = encoding.x;
  const x2Channel = encoding.x2;
  const yChannel = encoding.y;

  if (!xChannel || !x2Channel || !yChannel || !scales.x || !scales.y) return [];

  const xScale = scales.x.scale as ScaleLinear<number, number>;
  const yScale = scales.y.scale as ScaleLinear<number, number>;

  // Baseline: the pixel y the bar's foot sits on. Mirrors computeColumnMarks —
  // a domain that excludes zero (sparkline mode) anchors to the domain floor
  // instead, otherwise every bar would render at the same height.
  const yDomain = yScale.domain() as [number, number];
  const yIncludesZero = yDomain[0] <= 0 && yDomain[1] >= 0;
  const baseline = yIncludesZero ? yScale(0) : yScale(yDomain[0]);

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const colorField = colorEnc?.type === 'quantitative' ? undefined : colorEnc?.field;

  const groups = groupByField(spec.data, colorField);
  // `stack` is opt-in here, the inverse of the band-axis bar default.
  const stackEnabled =
    groups.size > 1 &&
    (yChannel.stack === true ||
      yChannel.stack === 'zero' ||
      yChannel.stack === 'normalize' ||
      yChannel.stack === 'center');

  const marks =
    groups.size > 1 && stackEnabled
      ? stackedBins(groups, spec, scales, xScale, yScale, baseline, theme)
      : overlappingBins(groups, spec, scales, xScale, yScale, baseline, colorField);

  stampKeys(marks, xChannel.field, colorField);
  return marks;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Geometry shared by both layouts: the bar's x extent from its two bin edges. */
function binGeometry(
  row: DataRow,
  xField: string,
  x2Field: string,
  xScale: ScaleLinear<number, number>,
): { x: number; width: number } | undefined {
  const start = Number(row[xField]);
  const end = Number(row[x2Field]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;

  const px0 = xScale(start);
  const px1 = xScale(end);
  const left = Math.min(px0, px1);
  const span = Math.abs(px1 - px0);
  return { x: left, width: Math.max(span - BIN_GAP, MIN_BIN_WIDTH) };
}

function ariaFor(
  row: DataRow,
  xField: string,
  x2Field: string,
  yField: string,
  seriesKey: string | undefined,
): MarkAria {
  const start = Number(row[xField]);
  const end = Number(row[x2Field]);
  const value = Number(row[yField]);
  const range = `${formatNumber(start)} to ${formatNumber(end)}`;
  const prefix = seriesKey ? `${seriesKey}, ` : '';
  return { label: `${prefix}${range}: ${formatNumber(value)}` };
}

/**
 * ggplot's `position = "identity"`: every group draws its own bars at the same
 * bins, translucent so both distributions read through each other. Paint order
 * is data order (whichever group appears first in the rows), deliberately not
 * sorted by height: with translucent fills the z-order barely shows, and
 * sorting would make it flip whenever a value changes.
 */
function overlappingBins(
  groups: Map<string, DataRow[]>,
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleLinear<number, number>,
  baseline: number,
  colorField: string | undefined,
): RectMark[] {
  const encoding = spec.encoding as Encoding;
  const xField = encoding.x!.field;
  const x2Field = encoding.x2!.field;
  const yField = encoding.y!.field;

  const multi = groups.size > 1;
  const fillOpacity = multi
    ? (spec.markDef.fillOpacity ?? OVERLAP_FILL_OPACITY)
    : spec.markDef.fillOpacity;

  const marks: RectMark[] = [];
  for (const [key, rows] of groups) {
    const fill = getColor(scales, key);
    for (const row of rows) {
      const geom = binGeometry(row, xField, x2Field, xScale);
      if (!geom) continue;
      const value = Number(row[yField]);
      if (!Number.isFinite(value)) continue;

      // A count is never negative, but an authored bar + x2 spec can carry a
      // negative y. Anchor on the baseline in both directions rather than
      // clamping a negative height to a one-pixel stub at the endpoint.
      const endY = yScale(value);
      const top = Math.min(baseline, endY);
      const height = Math.max(Math.abs(baseline - endY), MIN_BAR_HEIGHT);
      marks.push({
        type: 'rect',
        x: geom.x,
        y: top,
        width: geom.width,
        height,
        fill,
        fillOpacity,
        // Histogram bars are contiguous; rounded corners read as gaps.
        cornerRadius: 0,
        orient: 'vertical',
        ...(colorField ? { seriesKey: key } : {}),
        data: row as Record<string, unknown>,
        aria: ariaFor(row, xField, x2Field, yField, colorField ? key : undefined),
      });
    }
  }
  return marks;
}

/** Opt-in stacking: segments sit on each other's shoulders, fully opaque. */
function stackedBins(
  groups: Map<string, DataRow[]>,
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleLinear<number, number>,
  baseline: number,
  theme?: ResolvedTheme,
): RectMark[] {
  const encoding = spec.encoding as Encoding;
  const xField = encoding.x!.field;
  const x2Field = encoding.x2!.field;
  const yField = encoding.y!.field;

  // Running pixel offset per bin, keyed on the bin's start value.
  const offsets = new Map<string, number>();
  const seam = stackSeamStroke(theme);
  const marks: RectMark[] = [];

  for (const [key, rows] of groups) {
    const fill = getColor(scales, key);
    for (const row of rows) {
      const geom = binGeometry(row, xField, x2Field, xScale);
      if (!geom) continue;
      const value = Number(row[yField]);
      // Stacking a negative segment has no coherent meaning for a count.
      if (!Number.isFinite(value) || value <= 0) continue;

      const binKey = serializeKeyValue(row[xField]);
      const used = offsets.get(binKey) ?? 0;
      const segmentHeight = Math.max(baseline - yScale(value), MIN_BAR_HEIGHT);
      const top = baseline - used - segmentHeight;
      offsets.set(binKey, used + segmentHeight);

      marks.push({
        type: 'rect',
        x: geom.x,
        y: top,
        width: geom.width,
        height: segmentHeight,
        fill,
        cornerRadius: 0,
        orient: 'vertical',
        stackGroup: binKey,
        stroke: seam,
        strokeWidth: 1,
        seriesKey: key,
        data: row as Record<string, unknown>,
        aria: ariaFor(row, xField, x2Field, yField, key),
      });
    }
  }
  return marks;
}

/** Stable identity keys so a data update matches bars across compiles. */
function stampKeys(marks: RectMark[], xField: string, colorField: string | undefined): void {
  const raw = marks.map((m) => {
    const series = colorField ? String(m.data[colorField] ?? '') : '';
    return `${series}|${serializeKeyValue(m.data[xField])}`;
  });
  const keys = dedupeKeys(raw);
  for (let i = 0; i < marks.length; i++) {
    marks[i].key = keys[i];
  }
}
