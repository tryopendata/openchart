/**
 * The house-style section's pin, run inside `withMotion`. Where the pinned block
 * fits (PIN_MEDIA) the scrub holds the block centred in the viewport for
 * PIN_VIEWPORTS heights, reports which stop the scroll is on, and scrubs the
 * progress rule. The scroll distance is reserved in CSS under the same media
 * query (landing-wall.css, `.scrub`), so the pin adds no spacer and nothing
 * below it moves when it starts. Elsewhere there is no pin: the stops stay buttons.
 */
import type { MotionTools } from "../../../scripts/motion";
import { stopAt } from "./scrub-progress";

/** Where the pinned block fits: wide enough for the chart beside its notes, tall enough to hold it. */
export const PIN_MEDIA = "(min-width: 1024px) and (min-height: 700px)";
/** How long the pin holds, in viewport heights. landing-wall.css reserves the same. */
export const PIN_VIEWPORTS = 2.5;

/** What the pin reports to the island: the pin's scroll range (null once released) and the current stop. */
export type PinCallbacks = {
  onPin: (pin: { start: number; end: number } | null) => void;
  onStop: (index: number) => void;
};

export type PinTargets = {
  /** The element that pins. */
  block: HTMLElement;
  /** The rule fill that grows with the scroll. */
  progress: HTMLElement;
  count: number;
};

export function pinScrub(
  { gsap, ScrollTrigger }: MotionTools,
  { block, progress, count }: PinTargets,
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
      trigger: block,
      pin: true,
      pinSpacing: false,
      start: "center center",
      end: () => `+=${Math.round(window.innerHeight * PIN_VIEWPORTS)}`,
      invalidateOnRefresh: true,
      animation: fill,
      // A short catch-up keeps the rule smooth on a wheel that jumps.
      scrub: 0.3,
      onUpdate: (self) => onStop(stopAt(self.progress, count)),
      onRefresh: (self) => onPin({ start: self.start, end: self.end }),
    });
    onPin({ start: trigger.start, end: trigger.end });
    // Web fonts change the block's height, and with it where the centred pin starts.
    let live = true;
    void document.fonts?.ready.then(() => live && ScrollTrigger.refresh());
    return () => {
      live = false;
      onPin(null);
    };
  });
  return () => media.revert();
}
