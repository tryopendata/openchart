/**
 * The resize frame's rules, kept apart from the DOM: how a key on the handle
 * moves the width, how a width is held inside the range, and which layout the
 * chart picks at a width. The thresholds repeat the library's, because
 * importing them would put the whole chart core in this island's up-front
 * JavaScript; frame-width.test.ts checks them against `getBreakpoint`.
 */

/** Below this width the chart lays out compact. The library's BREAKPOINT_COMPACT_MAX. */
export const COMPACT_BELOW = 400;
/** Up to and including this width the chart lays out medium. The library's BREAKPOINT_MEDIUM_MAX. */
export const MEDIUM_UP_TO = 700;

export type FrameBreakpoint = "compact" | "medium" | "full";

/** The layout the chart picks at a width, as the library's `getBreakpoint` decides it. */
export function breakpointFor(width: number): FrameBreakpoint {
  if (width < COMPACT_BELOW) return "compact";
  return width <= MEDIUM_UP_TO ? "medium" : "full";
}

/** Arrow keys move the handle this many px; Page Up and Page Down five times as far. */
export const KEY_STEP = 20;
const PAGE_STEP = KEY_STEP * 5;

export type WidthRange = { min: number; max: number };

/** A width rounded to whole px and held inside the range. */
export function clampWidth(width: number, range: WidthRange): number {
  return Math.round(Math.min(range.max, Math.max(range.min, width)));
}

/**
 * The width after a key press on the handle, or null for a key the slider does
 * not handle (so the browser keeps its default, such as Tab).
 */
export function widthAfterKey(key: string, width: number, range: WidthRange): number | null {
  const moves: Record<string, number> = {
    ArrowLeft: width - KEY_STEP,
    ArrowDown: width - KEY_STEP,
    ArrowRight: width + KEY_STEP,
    ArrowUp: width + KEY_STEP,
    PageDown: width - PAGE_STEP,
    PageUp: width + PAGE_STEP,
    Home: range.min,
    End: range.max,
  };
  const next = moves[key];
  return next === undefined ? null : clampWidth(next, range);
}
