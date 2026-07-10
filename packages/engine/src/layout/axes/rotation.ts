/**
 * Auto-rotation and thinning policy for band-scale x-axis tick labels.
 *
 * Band categories are data: every bar should keep its label. The policy
 * steepens the label angle until everything fits — flat, then -45°, then -90°
 * (vertical) — and only thins (uniform every-Nth) when even the steepest
 * usable angle cannot fit every label, which takes dozens of categories at
 * tiny steps.
 *
 * The collision geometry differs by orientation, and getting it right is what
 * makes thinning almost never necessary:
 *
 * - FLAT labels share a baseline, so adjacent labels collide when the widest
 *   label's width exceeds the anchor spacing.
 * - ROTATED labels are PARALLEL RIBBONS: every label leans at the same angle
 *   from its own anchor, so adjacent labels are parallel segments. They clear
 *   each other when EITHER the perpendicular separation between the ribbons
 *   (`spacing * |sin θ|`) exceeds one line height, OR the offset along the
 *   text direction (`spacing * |cos θ|`) exceeds the label length — finite
 *   segments slide past each other end-to-end at shallow angles. Earlier
 *   revisions modeled rotated labels as 1-D horizontal spans, which reported
 *   phantom collisions for long labels (dropping "2025" beside
 *   "2026 (to wk 17)") even though the rendered diagonals never touch.
 *
 * The layout planner and computeAxes must agree on these decisions: the
 * planner reserves the bottom margin for the rotated label footprint, and
 * computeAxes emits the same angle. Sharing this module keeps the reserved
 * space matched to the rendered labels (a mismatch spilled rotated ticks into
 * the source line).
 */

import { X_AXIS_ROTATED_EXTENT_CAP } from '@opendata-ai/openchart-core';

/** Band fraction above which flat labels are considered too wide to fit. */
const BAND_FIT_FRACTION = 0.85;

/** Diagonal angle tried first when flat labels don't fit. */
const AUTO_ROTATE_ANGLE = -45;

/** Vertical angle used when diagonal ribbons would touch. */
const STEEP_ROTATE_ANGLE = -90;

/** Line-height multiplier for a label's text ribbon thickness. */
const LINE_HEIGHT_FACTOR = 1.2;

/** Minimum visible gap between adjacent label ribbons, in px. */
const LABEL_GAP = 4;

/**
 * Perpendicular separation between adjacent rotated label ribbons.
 * Labels anchor at points `spacing` apart; leaning at `angleDeg` makes them
 * parallel lines whose perpendicular distance is `spacing * |sin(angle)|`.
 */
function ribbonSeparation(spacing: number, angleDeg: number): number {
  return spacing * Math.abs(Math.sin((angleDeg * Math.PI) / 180));
}

/**
 * Offset between adjacent labels measured along the text direction.
 * Finite labels clear each other end-to-end when this exceeds the label
 * length, even if the ribbons are closer than a line height — the escape
 * route that matters at shallow angles.
 */
function alongTextClearance(spacing: number, angleDeg: number): number {
  return spacing * Math.abs(Math.cos((angleDeg * Math.PI) / 180));
}

/** Whether every label fits at the given rotation without touching. */
function rotatedLabelsFit(
  spacing: number,
  angleDeg: number,
  fontSize: number,
  maxLabelWidth: number,
): boolean {
  return (
    ribbonSeparation(spacing, angleDeg) >= fontSize * LINE_HEIGHT_FACTOR + LABEL_GAP ||
    alongTextClearance(spacing, angleDeg) >= maxLabelWidth + LABEL_GAP
  );
}

/**
 * Decide the effective x tick angle for a band scale: the shallowest angle in
 * the ladder (flat → -45° → -90°) at which adjacent labels don't touch.
 *
 * The flat trigger compares the widest label against the bandwidth (does the
 * flat label fit its band?) — the long-standing rule, kept for stability.
 * The rotated steps use the parallel-ribbon fit test above.
 *
 * -90° projects the full label length vertically, so labels longer than the
 * reserved-extent cap would clip into the source line. For those the ladder
 * stays at -45° (smaller vertical footprint) and lets the stride safety net
 * thin the ribbons instead.
 *
 * @param explicitAngle - User-specified labelAngle (wins if defined).
 * @param maxLabelWidth - Widest tick label width in pixels.
 * @param bandwidth - Band width in pixels (excludes inner padding).
 * @param labelCount - Number of category labels (rotation needs >= 2).
 * @param spacing - Distance between the closest adjacent DRAWN tick anchors.
 *   This is the band step when every category gets a tick, but a multiple of
 *   it when an explicit tickCount capped the tick set upstream.
 * @param fontSize - Tick label font size (ribbon thickness term).
 * @returns The explicit angle, `-45`, `-90`, or `undefined` (no rotation).
 */
export function resolveBandTickAngle(
  explicitAngle: number | undefined,
  maxLabelWidth: number,
  bandwidth: number,
  labelCount: number,
  spacing: number,
  fontSize: number,
): number | undefined {
  if (explicitAngle !== undefined) return explicitAngle;
  if (labelCount < 2) return undefined;
  if (maxLabelWidth <= bandwidth * BAND_FIT_FRACTION) return undefined;
  if (rotatedLabelsFit(spacing, AUTO_ROTATE_ANGLE, fontSize, maxLabelWidth)) {
    return AUTO_ROTATE_ANGLE;
  }
  return maxLabelWidth <= X_AXIS_ROTATED_EXTENT_CAP ? STEEP_ROTATE_ANGLE : AUTO_ROTATE_ANGLE;
}

/**
 * Uniform every-Nth retention stride for band tick labels — the safety net
 * for when even the resolved angle cannot fit every label (dozens of
 * categories at tiny steps, an explicit shallow labelAngle on a crowded axis,
 * or labels too long for the -90° escalation). Returns 1 (keep every label)
 * whenever labels fit.
 *
 * Callers keep indices counting back from the LAST label
 * (`(lastIdx - i) % stride === 0`) so the most recent category — usually the
 * most editorially important — is always labeled.
 *
 * Flat labels collide along their shared baseline, so the stride is driven by
 * the widest label's width. Rotated labels escape by either route — ribbon
 * separation or along-text clearance — and both scale linearly with the
 * stride, so the cheaper one wins.
 */
export function bandLabelStride(
  maxLabelWidth: number,
  angleDeg: number | undefined,
  fontSize: number,
  spacing: number,
): number {
  if (spacing <= 0) return 1;
  if (angleDeg === undefined || angleDeg === 0) {
    return Math.max(1, Math.ceil((maxLabelWidth + LABEL_GAP) / spacing));
  }
  const separation = ribbonSeparation(spacing, angleDeg);
  const clearance = alongTextClearance(spacing, angleDeg);
  const required = fontSize * LINE_HEIGHT_FACTOR + LABEL_GAP;
  const byRibbon = separation > 0 ? Math.ceil(required / separation) : Number.POSITIVE_INFINITY;
  const byLength =
    clearance > 0 ? Math.ceil((maxLabelWidth + LABEL_GAP) / clearance) : Number.POSITIVE_INFINITY;
  const stride = Math.min(byRibbon, byLength);
  return Number.isFinite(stride) ? Math.max(1, stride) : 1;
}
