/**
 * Pie / donut chart mark computation.
 *
 * Uses d3.pie() for angle calculation and d3.arc() for SVG path
 * generation. Supports sorting by value (largest first), small-slice
 * grouping into "Other", and donut variant with inner radius.
 */

import type {
  ArcMark,
  ConditionalValueDef,
  DataRow,
  Encoding,
  GradientDef,
  LayoutStrategy,
  MarkAria,
  Rect,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import {
  CATEGORICAL_FILL_PALETTE,
  formatPercent,
  isConditionalDef,
  isGradientDef,
  isOpaqueColor,
} from '@opendata-ai/openchart-core';
import type { PieArcDatum } from 'd3-shape';
import { arc as d3Arc, pie as d3Pie } from 'd3-shape';

import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { resolveConditionalValue } from '../../transforms/conditional';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Slices smaller than this fraction are grouped into "Other". */
const SMALL_SLICE_THRESHOLD = 0.03;

/** Separator stroke between adjacent slices, drawn in the canvas color. */
const SLICE_STROKE_WIDTH = 1.5;

/** Pad angle between slices, applied by both the pie layout and the arc
 *  generator. Shared with `buildArcPath` so data-update transitions rebuild
 *  paths with the exact gap the renderer drew. */
export const PIE_PAD_ANGLE = 0.01;

/**
 * Rebuild the SVG path for an arc from its resolved geometry. Used by the
 * vanilla transition driver to interpolate arc marks per frame; must stay in
 * lockstep with the `arcGenerator` below or the tween's final frame won't
 * match the rendered mark.
 */
export function buildArcPath(geom: {
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}): string {
  return (
    d3Arc()({
      innerRadius: geom.innerRadius,
      outerRadius: geom.outerRadius,
      startAngle: geom.startAngle,
      endAngle: geom.endAngle,
      padAngle: PIE_PAD_ANGLE,
    }) ?? ''
  );
}

/**
 * Fallback slice palette for callers that compute marks without a theme
 * (unit tests, direct callers). The renderer always passes the resolved
 * theme, so charts get `theme.colors.categoricalFill`.
 */
const DEFAULT_PALETTE: readonly string[] = CATEGORICAL_FILL_PALETTE;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SliceData {
  label: string;
  value: number;
  originalRow: DataRow;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group small slices (< threshold) into an "Other" category. */
function groupSmallSlices(slices: SliceData[], threshold: number): SliceData[] {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return slices;

  const big: SliceData[] = [];
  let otherValue = 0;

  for (const slice of slices) {
    if (slice.value / total < threshold) {
      otherValue += slice.value;
    } else {
      big.push(slice);
    }
  }

  if (otherValue > 0) {
    big.push({
      label: 'Other',
      value: otherValue,
      originalRow: { label: 'Other', value: otherValue },
    });
  }

  return big;
}

/**
 * Bounding box (in unit-radius coordinates) of a circular arc sweep from
 * startAngle to endAngle, following d3's angle convention: 0 is straight up,
 * increasing clockwise. Used to fit and center a partial pie/donut sweep
 * (e.g. a half-donut) within the available chart area, since a restricted
 * sweep's bounding box is smaller than the full circle's.
 */
function computeSweepBounds(
  startAngle: number,
  endAngle: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  // Sample the sweep endpoints plus the four cardinal directions (up, right,
  // down, left) that fall within [startAngle, endAngle], since those are the
  // only points where x or y can reach an extremum on a circle.
  const points: Array<{ x: number; y: number }> = [
    { x: Math.sin(startAngle), y: -Math.cos(startAngle) },
    { x: Math.sin(endAngle), y: -Math.cos(endAngle) },
  ];

  const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const span = endAngle - startAngle;
  for (const cardinal of cardinals) {
    // Normalize the cardinal angle to the first occurrence at or after
    // startAngle, then check whether it still falls within the swept range.
    const normalized = cardinal + Math.ceil((startAngle - cardinal) / (Math.PI * 2)) * Math.PI * 2;
    if (normalized <= startAngle + span) {
      points.push({ x: Math.sin(normalized), y: -Math.cos(normalized) });
    }
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute pie or donut arc marks from a normalized chart spec.
 *
 * Extracts category and value from the encoding channels. Categories
 * come from the color field, values from the quantitative y (or x) field.
 * Slices are sorted largest first. Small slices are grouped into "Other".
 *
 * @param isDonut - When true, creates a donut with inner radius at 60% of outer.
 */
export function computePieMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  _strategy: LayoutStrategy,
  isDonut = false,
  theme?: ResolvedTheme,
): ArcMark[] {
  // Arcs are a fill mark, so slices take the quieter fill palette.
  const palette = theme?.colors.categoricalFill ?? DEFAULT_PALETTE;
  // Slice separator: the canvas color, so the gap between slices reads as
  // background rather than as a drawn white ring on a dark chart.
  const sliceBg = theme?.colors.background;
  const sliceStroke = sliceBg && isOpaqueColor(sliceBg) ? sliceBg : '#ffffff';
  const encoding = spec.encoding as Encoding;
  const startAngle = spec.markDef.startAngle ?? 0;
  const endAngle = spec.markDef.endAngle ?? Math.PI * 2;

  // For pie/donut charts, we need a value field (typically y or x) and
  // a category field (typically color). The value field provides the slice sizes.
  const valueChannel = encoding.y ?? encoding.x;
  const categoryField =
    encoding.color && 'field' in encoding.color ? encoding.color.field : undefined;
  const conditionalColor =
    encoding.color && isConditionalDef(encoding.color)
      ? (encoding.color as ConditionalValueDef)
      : undefined;

  if (!valueChannel) return [];

  // Build slices from data
  let slices: SliceData[] = [];

  if (categoryField) {
    // Aggregate by category
    const categoryTotals = new Map<string, number>();
    const categoryRows = new Map<string, DataRow>();

    for (const row of spec.data) {
      const cat = String(row[categoryField] ?? '');
      const val = Number(row[valueChannel.field] ?? 0);
      if (!Number.isFinite(val) || val < 0) continue;

      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + val);
      if (!categoryRows.has(cat)) {
        categoryRows.set(cat, row);
      }
    }

    for (const [label, value] of categoryTotals) {
      slices.push({
        label,
        value,
        originalRow: categoryRows.get(label) ?? {
          [categoryField]: label,
          [valueChannel.field]: value,
        },
      });
    }
  } else {
    // Each data row is a slice. Use a label field if present, or index.
    for (let i = 0; i < spec.data.length; i++) {
      const row = spec.data[i];
      const val = Number(row[valueChannel.field] ?? 0);
      if (!Number.isFinite(val) || val < 0) continue;

      // Try common label fields
      const label = String(row.label ?? row.name ?? row.category ?? `Slice ${i + 1}`);

      slices.push({ label, value: val, originalRow: row });
    }
  }

  if (slices.length === 0) return [];

  // Sort by value descending (largest first)
  slices.sort((a, b) => b.value - a.value);

  // Group small slices into "Other"
  slices = groupSmallSlices(slices, SMALL_SLICE_THRESHOLD);

  // Compute pie layout
  const pieGenerator = d3Pie<SliceData>()
    .value((d) => d.value)
    .sort(null) // Already sorted
    .padAngle(PIE_PAD_ANGLE)
    .startAngle(startAngle)
    .endAngle(endAngle);

  const arcs = pieGenerator(slices);

  // Compute arc dimensions. A partial sweep (startAngle/endAngle narrower
  // than a full circle) has a bounding box smaller than the full circle, so
  // fit the radius and center to the actual sweep rather than the chart
  // area's full width/height — otherwise a half-donut would render at half
  // scale with wasted empty space below it.
  const sweepBounds = computeSweepBounds(startAngle, endAngle);
  const sweepWidth = sweepBounds.maxX - sweepBounds.minX;
  const sweepHeight = sweepBounds.maxY - sweepBounds.minY;
  const outerRadius = Math.min(chartArea.width / sweepWidth, chartArea.height / sweepHeight) * 0.85;
  const innerRadius = isDonut ? outerRadius * 0.6 : 0;

  // Center the sweep's bounding box within the chart area.
  const centerX =
    chartArea.x + chartArea.width / 2 - ((sweepBounds.minX + sweepBounds.maxX) / 2) * outerRadius;
  const centerY =
    chartArea.y + chartArea.height / 2 - ((sweepBounds.minY + sweepBounds.maxY) / 2) * outerRadius;

  const arcGenerator = d3Arc<PieArcDatum<SliceData>>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // Build arc marks
  const marks: ArcMark[] = [];
  const center = { x: centerX, y: centerY };
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  for (let i = 0; i < arcs.length; i++) {
    const arcDatum = arcs[i];
    const slice = arcDatum.data;

    // Get color: conditional (supports gradients) > scale > default palette
    let color: string | GradientDef;
    if (conditionalColor) {
      const resolved = resolveConditionalValue(
        slice.originalRow as Record<string, unknown>,
        conditionalColor,
      );
      if (resolved != null) {
        color = isGradientDef(resolved) ? resolved : String(resolved);
      } else if (scales.color && categoryField) {
        const colorScale = scales.color.scale as (v: string) => string;
        color = colorScale(slice.label);
      } else {
        color = palette[i % palette.length];
      }
    } else if (scales.color && categoryField) {
      const colorScale = scales.color.scale as (v: string) => string;
      color = colorScale(slice.label);
    } else {
      color = palette[i % palette.length];
    }

    // Generate SVG path (relative to 0,0; renderer wraps in translate)
    const path = arcGenerator(arcDatum) ?? '';

    // Compute centroid (for label positioning), offset to chart center
    const centroidResult = arcGenerator.centroid(arcDatum);

    const percentStr = total > 0 ? formatPercent(slice.value / total) : '0%';

    const aria: MarkAria = {
      label: `${slice.label}: ${slice.value} (${percentStr})`,
    };

    marks.push({
      type: 'arc',
      path,
      centroid: {
        x: centroidResult[0] + centerX,
        y: centroidResult[1] + centerY,
      },
      center,
      innerRadius,
      outerRadius,
      startAngle: arcDatum.startAngle,
      endAngle: arcDatum.endAngle,
      fill: color,
      stroke: sliceStroke,
      strokeWidth: SLICE_STROKE_WIDTH,
      seriesKey: slice.label,
      data: slice.originalRow as Record<string, unknown>,
      aria,
    });
  }

  // Stamp keys: slice label (category name) as the natural identity
  const rawKeys = marks.map((m) => {
    const label = categoryField
      ? String(m.data[categoryField] ?? '')
      : String(m.data.label ?? m.data.name ?? m.data.category ?? '');
    return serializeKeyValue(label);
  });
  const keys = dedupeKeys(rawKeys);
  for (let i = 0; i < marks.length; i++) {
    marks[i].key = keys[i];
  }

  return marks;
}
