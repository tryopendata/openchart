/**
 * The width the responsive frame takes as its section scrolls past: full at the
 * start, the narrowest at the end. Pure, so ResizeFrame only wires the scroll.
 */
import type { WidthRange } from "./frame-width";

/** Below this progress the frame holds its full width, so the reader sees the full layout first. */
const HOLD_FULL_UNTIL = 0.15;
/** From this progress the frame holds its narrowest width, so the compact layout stays a moment. */
const HOLD_NARROW_FROM = 0.85;
/**
 * Widths in between land on multiples of this many px. The chart re-lays out on
 * every width change, so steps keep that to one layout per 8px of travel.
 */
const SNAP_PX = 8;

/**
 * The frame's width for the section's scroll progress (0 as it enters, 1 as it
 * leaves): `range.max` up to 0.15, `range.min` from 0.85, linear between and
 * snapped to 8px steps so the chart re-lays out in steps, not every frame.
 */
export function widthAtProgress(progress: number, range: WidthRange): number {
  const travel = (progress - HOLD_FULL_UNTIL) / (HOLD_NARROW_FROM - HOLD_FULL_UNTIL);
  if (travel <= 0) return range.max;
  if (travel >= 1) return range.min;
  const linear = range.max - travel * (range.max - range.min);
  const snapped = Math.round(linear / SNAP_PX) * SNAP_PX;
  return Math.min(range.max, Math.max(range.min, snapped));
}
