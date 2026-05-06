/**
 * Shared constants for endpoint-labels prediction and computation.
 *
 * Both `predict.ts` (width-only, runs before marks) and `compute.ts` (full
 * layout, runs after marks) read from these so the predicted width can never
 * drift from the eventual rendered geometry.
 */

/** Series-name label font size, matching the existing end-of-line label style. */
export const ENDPOINT_LABEL_FONT_SIZE = 11;

/** Series-name label font weight (semibold for visual prominence). */
export const ENDPOINT_LABEL_FONT_WEIGHT = 600;

/** Last-value label font size (slightly smaller than the series name). */
export const ENDPOINT_VALUE_FONT_SIZE = 11;

/** Last-value label font weight (regular, muted text tone). */
export const ENDPOINT_VALUE_FONT_WEIGHT = 400;

/** Default wrap width for long series names, in pixels. */
export const ENDPOINT_WRAP_WIDTH_DEFAULT = 96;

/** Width of the colored stroke segment swatch drawn left of the label. */
export const ENDPOINT_SWATCH_SIZE = 14;

/** Gap between swatch, label, and value. */
export const ENDPOINT_GAP = 6;

/** Line height multiplier for wrapped label lines. */
export const ENDPOINT_LINE_HEIGHT = 1.25;

/** Pixel padding between the chart area's right edge and the column. */
export const ENDPOINT_COLUMN_GAP = 16;

/** Vertical pad between the last wrapped label line and the value text. */
export const ENDPOINT_VALUE_GAP = 2;

/** Default open-circle marker radius on the line. */
export const ENDPOINT_MARKER_RADIUS = 4;

/** Default open-circle marker stroke width. */
export const ENDPOINT_MARKER_STROKE_WIDTH = 2;

/** Threshold (px) above which a leader line connects label back to data point. */
export const ENDPOINT_LEADER_THRESHOLD = 8;
