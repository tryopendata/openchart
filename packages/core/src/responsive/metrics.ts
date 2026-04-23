/**
 * Pixel-level responsive metrics for chart layout.
 *
 * These are the numeric tuning values that correspond to the semantic decisions
 * in LayoutStrategy. Centralizing them here ensures the engine and renderer
 * always agree on the same thresholds and offsets without duplicating raw numbers.
 *
 * LayoutStrategy is semantic (what to show), this module is metric (how much space).
 */

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
