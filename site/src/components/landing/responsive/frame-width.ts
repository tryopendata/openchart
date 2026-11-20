/**
 * The resize frame's rules, kept apart from the DOM: which breakpoint a width
 * falls in (the library's own compact, medium and full thresholds), how a key
 * on the handle moves the width, and how a width is kept inside the range.
 */

/** The library lays a chart out as compact under 400px and medium up to 700px. */
export const COMPACT_BELOW = 400;
export const MEDIUM_BELOW = 700;
/** Arrow keys move the handle this many px; Page Up and Page Down five times as far. */
export const KEY_STEP = 20;
const PAGE_STEP = KEY_STEP * 5;

export type Breakpoint = "compact" | "medium" | "full";
export type WidthRange = { min: number; max: number };

/** The breakpoint name for a chart width in px. */
export function breakpointFor(width: number): Breakpoint {
  if (width < COMPACT_BELOW) return "compact";
  if (width < MEDIUM_BELOW) return "medium";
  return "full";
}

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
