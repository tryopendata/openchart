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
} from '@opendata-ai/openchart-core';
import { isConditionalDef, isGradientDef } from '@opendata-ai/openchart-core';
import type { PieArcDatum } from 'd3-shape';
import { arc as d3Arc, pie as d3Pie } from 'd3-shape';

import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { resolveConditionalValue } from '../../transforms/conditional';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Slices smaller than this fraction are grouped into "Other". */
const SMALL_SLICE_THRESHOLD = 0.03;

/** Default color palette when no color scale is available. */
const DEFAULT_PALETTE = [
  '#1b7fa3',
  '#c44e52',
  '#6a9f58',
  '#d47215',
  '#507e79',
  '#9a6a8d',
  '#c4636b',
  '#9c755f',
  '#a88f22',
  '#858078',
];

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
): ArcMark[] {
  const encoding = spec.encoding as Encoding;

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
    .padAngle(0.01);

  const arcs = pieGenerator(slices);

  // Compute arc dimensions
  const centerX = chartArea.x + chartArea.width / 2;
  const centerY = chartArea.y + chartArea.height / 2;
  const outerRadius = (Math.min(chartArea.width, chartArea.height) / 2) * 0.85;
  const innerRadius = isDonut ? outerRadius * 0.6 : 0;

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
        color = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      }
    } else if (scales.color && categoryField) {
      const colorScale = scales.color.scale as (v: string) => string;
      color = colorScale(slice.label);
    } else {
      color = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
    }

    // Generate SVG path (relative to 0,0; renderer wraps in translate)
    const path = arcGenerator(arcDatum) ?? '';

    // Compute centroid (for label positioning), offset to chart center
    const centroidResult = arcGenerator.centroid(arcDatum);

    const percentage = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0';

    const aria: MarkAria = {
      label: `${slice.label}: ${slice.value} (${percentage}%)`,
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
      stroke: '#ffffff',
      strokeWidth: 2,
      data: slice.originalRow as Record<string, unknown>,
      aria,
    });
  }

  return marks;
}
