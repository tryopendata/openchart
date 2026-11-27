/**
 * The edit section's one-time self-demonstration: the callout moves to a
 * second position and back, so the reader sees it can be dragged.
 *
 * GSAP tweens a plain `{ dx, dy }` object and hands each value to `onOffset`;
 * the island turns it into the chart's spec and the library draws it. GSAP
 * never touches the SVG. It runs through `withMotion`, so a reader who prefers
 * reduced motion gets nothing, and a GSAP that fails to load leaves the callout
 * where the spec put it.
 *
 * It plays at most once. If the reader turns on reduced motion while it plays,
 * `withMotion` reverts it and `onStop` reports that; turning motion back on
 * does not replay it.
 */
import { type MotionTools, withMotion } from "../../../scripts/motion";
import type { Offset } from "./callout-offset";

/** What the demonstration needs from the island. */
export type CalloutDemoOptions = {
  /** Where the callout starts and ends. */
  from: Offset;
  /** Where it goes in between. */
  to: Offset;
  /** Called with each offset on the way. */
  onOffset: (offset: Offset) => void;
  /** Called once the callout is back at `from` after a full run. */
  onComplete?: () => void;
  /**
   * Called when the run is cut short by something other than the returned stop
   * function: the reader turning on reduced motion mid-run.
   */
  onStop?: () => void;
};

/** Out and back take this long together, in seconds. */
const DEMO_SECONDS = 1.6;
/** The pause at the far position, in seconds, so the move reads as deliberate. */
const HOLD_SECONDS = 0.25;

/** Plays the demonstration once; the returned function stops it at once, without `onStop`. */
export function playCalloutDemo(options: CalloutDemoOptions): () => void {
  const { from, to, onOffset, onComplete, onStop } = options;
  const leg = (DEMO_SECONDS - HOLD_SECONDS) / 2;
  let started = false;
  let settled = false;

  function calloutDemo({ gsap }: MotionTools) {
    // withMotion runs setup again when motion is turned back on; the demonstration already had its turn.
    if (started) return;
    started = true;
    const position = { ...from };
    // Reverting the context renders the tweens back to their start; once stopped, that is not a move.
    const report = () => {
      if (!settled) onOffset({ dx: position.dx, dy: position.dy });
    };
    const timeline = gsap.timeline({
      onComplete: () => {
        settled = true;
        onComplete?.();
      },
    });
    timeline
      .to(position, { ...to, duration: leg, ease: "power2.inOut", onUpdate: report })
      .to(position, {
        ...from,
        duration: leg,
        delay: HOLD_SECONDS,
        ease: "power2.inOut",
        onUpdate: report,
      });
    return () => {
      timeline.kill();
      if (settled) return;
      settled = true;
      onStop?.();
    };
  }

  const revert = withMotion(calloutDemo);
  return () => {
    settled = true;
    revert();
  };
}
