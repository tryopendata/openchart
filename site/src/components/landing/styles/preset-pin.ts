/**
 * The house-style section's pin, run inside `withMotion`. At 900px and wider the
 * scrub pins for 2.5 viewport heights, reports which stop the scroll is on, and
 * scrubs the progress rule with the scroll. Narrower screens get no pin: the
 * stops stay a row of buttons. The returned teardown removes the pin and its spacer.
 */
import type { MotionTools } from "../../../scripts/motion";
import { stopAt } from "./scrub-progress";

/** The width from which the section pins. */
export const PIN_MEDIA = "(min-width: 900px)";
/** How long the pin holds, in viewport heights. */
const PIN_VIEWPORTS = 2.5;
/** Room left above the pinned scrub. */
const PIN_TOP_PX = 32;

/** What the pin reports to the island: the pin itself (null once released) and the current stop. */
export type PinCallbacks = {
  onPin: (pin: { start: number; end: number } | null) => void;
  onStop: (index: number) => void;
};

export type PinTargets = {
  /** The element that pins: the island's root. */
  root: HTMLElement;
  /** The rule fill that grows with the scroll. */
  progress: HTMLElement;
  count: number;
};

export function pinScrub(
  { gsap, ScrollTrigger }: MotionTools,
  { root, progress, count }: PinTargets,
  { onPin, onStop }: PinCallbacks,
): () => void {
  const media = gsap.matchMedia();
  media.add(PIN_MEDIA, () => {
    const fill = gsap.fromTo(
      progress,
      { scaleX: 0 },
      { scaleX: 1, ease: "none", transformOrigin: "0 50%" },
    );
    const trigger = ScrollTrigger.create({
      trigger: root,
      pin: true,
      start: `top top+=${PIN_TOP_PX}`,
      end: () => `+=${Math.round(window.innerHeight * PIN_VIEWPORTS)}`,
      invalidateOnRefresh: true,
      animation: fill,
      // A short catch-up keeps the rule smooth on a wheel that jumps.
      scrub: 0.4,
      onUpdate: (self) => onStop(stopAt(self.progress, count)),
      onRefresh: (self) => onPin({ start: self.start, end: self.end }),
    });
    onPin({ start: trigger.start, end: trigger.end });
    return () => onPin(null);
  });
  return () => media.revert();
}
