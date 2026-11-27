/**
 * How far the scroll story's rail has filled: the share of the steps column the
 * trigger line has passed. Pure, so ChartStoryScroll only measures and writes.
 */

/** The steps column's box, in the same coordinates as the trigger line. */
export type StepsBox = { top: number; height: number };

/**
 * The rail's fill from 0 (trigger line at or above the steps' top) to 1 (at or
 * past their bottom), linear between. A column with no height is 0.
 */
export function railProgress(_steps: StepsBox, _triggerY: number): number {
  throw new Error("railProgress is not implemented.");
}
