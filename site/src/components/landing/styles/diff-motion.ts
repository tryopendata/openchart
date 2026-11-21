/**
 * The crossfade between one stop's notes (name, description, theme lines) and
 * the next, run only when motion is allowed. It is one beat: the outgoing copy,
 * laid over the new one, fades out while the new copy fades in and settles, on
 * the same duration and curve. The chart is never part of it: the library's own
 * transition moves the chart over the same moment.
 */
import type { MotionTools } from "../../../scripts/motion";

/** One beat, about as long as the library's update transition. */
const BEAT_SECONDS = 0.4;
const EASE = "power3.out";

/** A layer coming in and the copy of the previous layer laid over it, if there is one. */
export type CrossfadePair = { incoming: Element | null; outgoing: Element | null };

/** The running crossfade, so the next stop can finish it first. */
export type Crossfade = { finish(): void };

/**
 * Crossfades every pair at once and calls `done` when the outgoing copies can go.
 * `finish()` jumps to the end without calling `done`: the caller is about to
 * start the next crossfade, which brings its own outgoing copies.
 */
export function crossfade(
  { gsap }: MotionTools,
  pairs: CrossfadePair[],
  done: () => void,
): Crossfade {
  const timeline = gsap.timeline({ onComplete: done });
  for (const { incoming, outgoing } of pairs) {
    if (outgoing) {
      timeline.to(outgoing, { opacity: 0, duration: BEAT_SECONDS, ease: EASE }, 0);
    }
    if (incoming) {
      timeline.fromTo(
        incoming,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: BEAT_SECONDS, ease: EASE },
        0,
      );
    }
  }
  return {
    finish() {
      timeline.eventCallback("onComplete", null);
      timeline.progress(1).kill();
    },
  };
}
