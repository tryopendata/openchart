/**
 * Pixel-level responsive metrics for chart layout.
 *
 * These are the numeric tuning values that correspond to the semantic decisions
 * in LayoutStrategy. Centralizing them here ensures the engine and renderer
 * always agree on the same thresholds and offsets without duplicating raw numbers.
 *
 * LayoutStrategy is semantic (what to show), this module is metric (how much space).
 */

import { estimateTextWidth } from '../layout/text-measure';
import { BREAKPOINT_COMPACT_MAX } from './breakpoints';

// ---------------------------------------------------------------------------
// Y-axis title offsets
// ---------------------------------------------------------------------------

/** Distance from the chart edge to the rotated y-axis title center (compact viewports). */
export const AXIS_TITLE_OFFSET_COMPACT = 35;

/** Distance from the chart edge to the rotated y-axis title center (standard viewports). */
export const AXIS_TITLE_OFFSET_DEFAULT = 45;

/** Returns the y-axis title offset appropriate for the given container width. */
export function getAxisTitleOffset(width: number): number {
  return width < BREAKPOINT_COMPACT_MAX ? AXIS_TITLE_OFFSET_COMPACT : AXIS_TITLE_OFFSET_DEFAULT;
}

// ---------------------------------------------------------------------------
// Horizontal padding
// ---------------------------------------------------------------------------

/**
 * On compact viewports axis titles and tick labels tolerate closer container edges
 * than chrome text (title, subtitle). Reduce horizontal padding to reclaim space.
 */
export const HPAD_COMPACT_FRACTION = 0.5;

/** Minimum horizontal padding regardless of scaling. */
export const HPAD_COMPACT_MIN = 4;

// ---------------------------------------------------------------------------
// Tick label offset
// ---------------------------------------------------------------------------

/**
 * Horizontal gap between the chart edge and the near edge of y-axis tick labels.
 * The engine uses this to reserve right-axis margin; the renderer uses it to position labels.
 * Both must agree on this value — do not change one without the other.
 */
export const TICK_LABEL_OFFSET = 6;

// ---------------------------------------------------------------------------
// Axis title trailing padding
// ---------------------------------------------------------------------------

/**
 * Extra padding beyond half-glyph height added to the rotated axis title margin on
 * standard (non-compact) viewports. Omitted on compact viewports to save space.
 */
export const AXIS_TITLE_TRAILING_PAD = 4;

// ---------------------------------------------------------------------------
// Axis title gap
// ---------------------------------------------------------------------------

/**
 * Visible breathing room between the widest tick label's far edge and the
 * rotated y-axis title's near edge.
 *
 * The title is rotated -90deg and anchored at its center, so its glyph box
 * extends half the title font size toward the tick labels. To keep the gap
 * constant regardless of title font size, callers add that half-glyph on top
 * of this value (see axisTitleOffset() below). At the old fixed gap of 14 the
 * clearance silently shrank as the font grew (14 - 11 = 3px at body size 21),
 * which let large-font titles collide with the tick labels.
 *
 * Used in both the engine (dimensions.ts margin reservation) and the renderer
 * (axes.ts title placement) via axisTitleOffset(). Both must agree on this value.
 */
export const AXIS_TITLE_GAP = 7;

/**
 * Computes the distance from the chart edge to the rotated y-axis title's center.
 *
 * The title center must sit far enough left that, after accounting for the
 * widest tick label and the title's own half-glyph height, AXIS_TITLE_GAP of
 * visible clearance remains. Falls back to the viewport-minimum offset when the
 * dynamic value would be smaller (short tick labels on wide containers).
 *
 * When `inline` is true the y-tick labels render inside the chart area (above
 * their gridlines) rather than in a left gutter, so the title only needs to
 * clear the chart edge — no tick-label width and no viewport-minimum floor,
 * both of which would otherwise leave a dead gap between the title and the plot.
 *
 * Shared by the engine (margin reservation) and the renderer (title placement)
 * so the reserved space always matches where the title is drawn.
 */
export function axisTitleOffset(
  maxTickLabelWidth: number,
  titleFontSize: number,
  width: number,
  inline = false,
): number {
  const halfTitleGlyph = Math.ceil(titleFontSize / 2);
  if (inline) {
    // No gutter tick labels to clear: title edge + gap + half-glyph only.
    return TICK_LABEL_OFFSET + AXIS_TITLE_GAP + halfTitleGlyph;
  }
  const dynamic = TICK_LABEL_OFFSET + maxTickLabelWidth + AXIS_TITLE_GAP + halfTitleGlyph;
  return Math.max(dynamic, getAxisTitleOffset(width));
}

// ---------------------------------------------------------------------------
// Narrow viewport threshold (between compact and medium)
// ---------------------------------------------------------------------------

/**
 * Width below which "narrow" adjustments apply: extra iOS Safari top padding and
 * tighter category label gaps. Sits between compact (< 400) and medium (400–700).
 * Not a semantic breakpoint — a layout heuristic for narrow-but-not-compact containers.
 */
export const NARROW_VIEWPORT_MAX = 500;

// ---------------------------------------------------------------------------
// Top padding (iOS Safari address bar / notch clearance)
// ---------------------------------------------------------------------------

/** Extra top padding added below NARROW_VIEWPORT_MAX to clear iOS Safari browser chrome. */
export const TOP_PAD_EXTRA_NARROW = 10;

/** @deprecated Use NARROW_VIEWPORT_MAX instead. */
export const TOP_PAD_NARROW_MAX = NARROW_VIEWPORT_MAX;

// ---------------------------------------------------------------------------
// Category label gaps (left-axis bar/dot charts)
// ---------------------------------------------------------------------------

/** Gap between category label text and chart edge on narrow viewports (< NARROW_VIEWPORT_MAX). */
export const LABEL_GAP_COMPACT = 8;

/** Gap between category label text and chart edge on standard viewports. */
export const LABEL_GAP_DEFAULT = 12;

/** @deprecated Use NARROW_VIEWPORT_MAX instead. */
export const LABEL_GAP_NARROW_MAX = NARROW_VIEWPORT_MAX;

// ---------------------------------------------------------------------------
// Max left-axis label fraction
// ---------------------------------------------------------------------------

/**
 * Width threshold for the medium left-label fraction cap.
 * Sits between medium (400-700) and full (> 700) to prevent wide category labels
 * from consuming too much horizontal space at mid-range widths.
 */
export const MAX_LEFT_LABEL_FRACTION_MEDIUM_MAX = 600;

/** Max fraction of container width reservable for left category labels (compact). */
export const MAX_LEFT_LABEL_FRACTION_COMPACT = 0.45;

/** Max fraction of container width reservable for left category labels (mid-range). */
export const MAX_LEFT_LABEL_FRACTION_MEDIUM = 0.55;

/** Max fraction of container width reservable for left category labels (standard). */
export const MAX_LEFT_LABEL_FRACTION_DEFAULT = 1;

// ---------------------------------------------------------------------------
// X-axis extent (height below chart area)
// ---------------------------------------------------------------------------

export const X_AXIS_BAND_HEIGHT = 26;
export const X_AXIS_TITLE_BAND = 22;
export const X_AXIS_TITLE_BAND_ROTATED = 20;

/**
 * Ceiling on the vertical extent reserved for rotated x tick labels. The angle
 * ladder (engine layout/axes/rotation) avoids -90° for labels longer than this.
 *
 * The cap bounds the RESERVATION, so a label whose rotated projection exceeds it
 * must be truncated to fit — see `truncateRotatedLabel`. Reserving a capped band
 * while drawing the full string is what let long ticks spill past the axis and
 * collide with the source line.
 */
export const X_AXIS_ROTATED_EXTENT_CAP = 120;

/**
 * Line-height multiplier for a tick label's text ribbon. Shared by the
 * rotated-extent reservation below and the engine's rotation collision test
 * (layout/axes/rotation) so the reserved space and the fit threshold can't
 * drift apart.
 */
export const TICK_LINE_HEIGHT_FACTOR = 1.2;

/**
 * Gap between the axis line and the top of the rotated label band. Mirrors the
 * tick-mark-to-label offset used for flat labels; keeps the reservation matched
 * to the drawn footprint across Blink and WebKit, whose rotated-glyph metrics
 * differ by a couple of pixels. Shared by the extent reservation and the
 * truncation budget so they stay in lockstep.
 */
const AXIS_TO_LABEL_GAP = 3;

export interface XAxisExtentInput {
  labels: string[];
  tickAngle?: number;
  hasTitle: boolean;
  tickFontSize: number;
  tickFontWeight: number;
  xAxisHeight?: number;
  measure?: (text: string, fontSize: number, fontWeight: number) => number;
}

export function computeXAxisExtentFromLabels(input: XAxisExtentInput): number {
  const measure = input.measure ?? estimateTextWidth;
  const baseHeight = input.xAxisHeight ?? X_AXIS_BAND_HEIGHT;

  if (input.tickAngle && Math.abs(input.tickAngle) > 10) {
    const angleRad = Math.abs(input.tickAngle) * (Math.PI / 180);
    let maxLabelWidth = 40;
    for (const label of input.labels) {
      const w = measure(label, input.tickFontSize, input.tickFontWeight);
      if (w > maxLabelWidth) maxLabelWidth = w;
    }
    // Vertical extent of a rotated label = the projection of its bounding box
    // onto the vertical axis: textWidth*|sin θ| (the tilted length) plus
    // lineHeight*|cos θ| (the label's own height, which still contributes
    // unless the text is fully vertical). Measuring only the sin term
    // under-reserved space, letting rotated ticks spill into the source line.
    const lineHeight = input.tickFontSize * TICK_LINE_HEIGHT_FACTOR;
    const rotatedHeight = Math.min(
      maxLabelWidth * Math.sin(angleRad) + lineHeight * Math.cos(angleRad) + AXIS_TO_LABEL_GAP,
      X_AXIS_ROTATED_EXTENT_CAP,
    );
    return input.hasTitle ? rotatedHeight + X_AXIS_TITLE_BAND_ROTATED : rotatedHeight;
  }

  const tickExtent = 4 + input.tickFontSize + Math.max(11, Math.ceil(input.tickFontSize * 0.7));
  const flatHeight = Math.max(baseHeight, tickExtent);
  return input.hasTitle ? flatHeight + X_AXIS_TITLE_BAND : flatHeight;
}

/**
 * The widest a rotated tick label may be before its vertical projection exceeds
 * `X_AXIS_ROTATED_EXTENT_CAP`.
 *
 * Inverts the rotated-extent formula in `computeXAxisExtentFromLabels`:
 *
 *   extent = width*sin(θ) + lineHeight*cos(θ) + gap
 *   width  = (cap - lineHeight*cos(θ) - gap) / sin(θ)
 *
 * Deriving it from the same terms (rather than hardcoding a second number) keeps
 * the truncation budget and the space reservation locked together — if one
 * changes, the other follows.
 */
export function maxRotatedLabelWidth(tickAngle: number, tickFontSize: number): number {
  const angleRad = Math.abs(tickAngle) * (Math.PI / 180);
  const sin = Math.sin(angleRad);
  // A flat (or near-flat) label has no vertical projection to bound.
  if (sin <= 0.001) return Number.POSITIVE_INFINITY;
  const lineHeight = tickFontSize * TICK_LINE_HEIGHT_FACTOR;
  const usable = X_AXIS_ROTATED_EXTENT_CAP - lineHeight * Math.cos(angleRad) - AXIS_TO_LABEL_GAP;
  return Math.max(0, usable / sin);
}

/**
 * Truncate a label with an ellipsis so it fits inside an explicit pixel budget.
 * Returns the label unchanged when it already fits.
 *
 * Binary-search on character count against the real measure function, so it
 * respects proportional fonts rather than assuming a fixed character width.
 */
export function truncateToWidth(
  label: string,
  budget: number,
  fontSize: number,
  fontWeight: number,
  measure: (text: string, fontSize: number, fontWeight?: number) => number = estimateTextWidth,
): string {
  if (!Number.isFinite(budget)) return label;
  if (measure(label, fontSize, fontWeight) <= budget) return label;

  const ELLIPSIS = '…';
  // Nothing sensible fits: keep a single character + ellipsis rather than
  // returning an empty label.
  let lo = 0;
  let hi = label.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = label.slice(0, mid) + ELLIPSIS;
    if (measure(candidate, fontSize, fontWeight) <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? label.slice(0, lo).trimEnd() + ELLIPSIS : ELLIPSIS;
}

/**
 * Truncate a rotated tick label with an ellipsis so it fits inside the capped
 * reservation. Returns the label unchanged when it already fits.
 *
 * Delegates to `truncateToWidth` with the budget derived from the rotation
 * geometry, so the binary-search stays in one place.
 */
export function truncateRotatedLabel(
  label: string,
  tickAngle: number,
  tickFontSize: number,
  tickFontWeight: number,
  measure: (text: string, fontSize: number, fontWeight?: number) => number = estimateTextWidth,
): string {
  const budget = maxRotatedLabelWidth(tickAngle, tickFontSize);
  return truncateToWidth(label, budget, tickFontSize, tickFontWeight, measure);
}
