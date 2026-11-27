/**
 * The edit section's one-time self-demonstration: the callout moves to a
 * second position and back, so the reader sees it can be dragged.
 *
 * GSAP tweens a plain `{ dx, dy }` object and hands each value to `onOffset`;
 * the island turns it into the chart's spec and the library draws it. GSAP
 * never touches the SVG. It runs through `withMotion`, so a reader who prefers
 * reduced motion gets nothing, and a GSAP that fails to load leaves the callout
 * where the spec put it.
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
  /** Called once the callout is back at `from` after a full run; not when stopped early. */
  onComplete?: () => void;
};

/** Out and back take this long together, in seconds. */
const DEMO_SECONDS = 1.6;
/** The pause at the far position, in seconds, so the move reads as deliberate. */
const HOLD_SECONDS = 0.25;

/** Plays the demonstration once; the returned function stops it at once. */
export function playCalloutDemo(options: CalloutDemoOptions): () => void {
  const { from, to, onOffset, onComplete } = options;
  const leg = (DEMO_SECONDS - HOLD_SECONDS) / 2;
  function calloutDemo({ gsap }: MotionTools) {
    const position = { ...from };
    const report = () => onOffset({ dx: position.dx, dy: position.dy });
    const timeline = gsap.timeline({ onComplete });
    timeline
      .to(position, { ...to, duration: leg, ease: "power2.inOut", onUpdate: report })
      .to(position, {
        ...from,
        duration: leg,
        delay: HOLD_SECONDS,
        ease: "power2.inOut",
        onUpdate: report,
      });
    return () => timeline.kill();
  }
  return withMotion(calloutDemo);
}
