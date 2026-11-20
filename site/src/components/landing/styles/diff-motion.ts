/**
 * The crossfade between one stop's theme lines and the next, run only when
 * `withMotion` allows it. The outgoing lines fade where they stand while the new
 * ones lift in a line at a time. The chart is never part of it: the library's own
 * transition moves the chart.
 */
import type { MotionTools } from "../../../scripts/motion";

const IN_SECONDS = 0.5;
const OUT_SECONDS = 0.3;
const LINE_STEP = 0.035;

/**
 * Fades `outgoing` (the previous lines, laid over the new ones) and brings in
 * `incoming` and the stop's name. Calls `done` once the old lines are gone.
 * Returns the timeline so the next stop can cut it short.
 */
export function crossfadeLines(
  { gsap }: MotionTools,
  parts: { name: Element | null; incoming: Element[]; outgoing: Element | null },
  done: () => void,
) {
  const timeline = gsap.timeline({ onComplete: done });
  if (parts.outgoing) {
    timeline.to(parts.outgoing, { opacity: 0, duration: OUT_SECONDS, ease: "power3.out" }, 0);
  }
  if (parts.name) {
    timeline.fromTo(
      parts.name,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: IN_SECONDS, ease: "expo.out" },
      0,
    );
  }
  timeline.fromTo(
    parts.incoming,
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: IN_SECONDS, ease: "power3.out", stagger: LINE_STEP },
    0.08,
  );
  return timeline;
}
