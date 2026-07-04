/**
 * Auto-rotation decision for band-scale x-axis tick labels.
 *
 * Vertical band x-axes rotate their tick labels to -45° when horizontal
 * labels are wider than the available band. The layout planner and
 * computeAxes must agree on this decision: the planner reserves the bottom
 * margin for the rotated label footprint, and computeAxes emits the same
 * angle. Sharing this rule keeps the reserved space matched to the rendered
 * labels (a mismatch spilled rotated ticks into the source line).
 */

/** Band fraction above which horizontal labels are considered too wide to fit. */
const BAND_FIT_FRACTION = 0.85;

/** Angle used when band labels don't fit horizontally. */
const AUTO_ROTATE_ANGLE = -45;

/**
 * Decide the effective x tick angle for a band scale.
 *
 * @param explicitAngle - User-specified labelAngle (wins if defined).
 * @param maxLabelWidth - Widest tick label width in pixels.
 * @param bandwidth - Band width in pixels.
 * @param labelCount - Number of category labels (rotation needs >= 2).
 * @returns The explicit angle, `-45` if auto-rotation triggers, or `undefined`.
 */
export function resolveBandTickAngle(
  explicitAngle: number | undefined,
  maxLabelWidth: number,
  bandwidth: number,
  labelCount: number,
): number | undefined {
  if (explicitAngle !== undefined) return explicitAngle;
  if (labelCount < 2) return undefined;
  return maxLabelWidth > bandwidth * BAND_FIT_FRACTION ? AUTO_ROTATE_ANGLE : undefined;
}
