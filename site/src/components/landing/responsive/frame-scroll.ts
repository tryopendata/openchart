/**
 * The width the responsive frame takes as its section scrolls past: full at the
 * start, the narrowest at the end. Pure, so ResizeFrame only wires the scroll.
 */
import type { WidthRange } from "./frame-width";

/**
 * The frame's width for the section's scroll progress (0 as it enters, 1 as it
 * leaves): `range.max` up to 0.15, `range.min` from 0.85, linear between and
 * snapped to 8px steps so the chart re-lays out in steps, not every frame.
 */
export function widthAtProgress(_progress: number, _range: WidthRange): number {
  throw new Error("widthAtProgress is not implemented.");
}
