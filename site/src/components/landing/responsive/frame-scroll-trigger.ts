/**
 * The responsive frame's scroll link, run with the tools `withMotion` hands
 * over: where the page is wide enough (FOLLOW_MEDIA) a ScrollTrigger reports
 * how far the frame's figure has travelled through the viewport. No pin and no
 * spacer, so the page keeps its height. Elsewhere, or once the media query
 * stops matching, it reports null and the frame is the reader's alone.
 */
import type { MotionTools } from "../../../scripts/motion";

/**
 * Where the frame follows the scroll. Under 1024px there is too little width to
 * show the narrowing; under 700px tall the frame is never mostly on screen while
 * it narrows. landing-responsive.css reserves the figure's height under the same query.
 */
export const FOLLOW_MEDIA = "(min-width: 1024px) and (min-height: 700px)";

/**
 * Progress 0 when the figure's top is three quarters down the viewport, 1 when
 * its bottom reaches the middle. With the holds in frame-scroll.ts, the frame
 * starts narrowing once about two thirds of it is on screen and reaches its
 * narrowest as its top meets the viewport's top, so every width is seen.
 */
const START = "top 75%";
const END = "bottom center";

/** Called with the scroll progress (0 to 1), or null when the scroll no longer drives the frame. */
export type ProgressListener = (progress: number | null) => void;

/** Links `figure`'s travel through the viewport to `onProgress`. Returns the teardown. */
export function followFrameScroll(
  { gsap, ScrollTrigger }: MotionTools,
  figure: HTMLElement,
  onProgress: ProgressListener,
): () => void {
  const media = gsap.matchMedia();
  media.add(FOLLOW_MEDIA, () => {
    const trigger = ScrollTrigger.create({
      trigger: figure,
      start: START,
      end: END,
      invalidateOnRefresh: true,
      onUpdate: (self) => onProgress(self.progress),
      onRefresh: (self) => onProgress(self.progress),
    });
    // onUpdate only fires on a change, so a page that loads part-way through the section starts in place.
    onProgress(trigger.progress);
    return () => onProgress(null);
  });
  return () => media.revert();
}
