/**
 * The responsive frame's scroll link, run with the tools `withMotion` hands
 * over: where the page is wide and tall enough (FOLLOW_MEDIA) a ScrollTrigger
 * reports how far the frame's figure has travelled through the viewport. No pin
 * and no spacer, so the page keeps its height. Elsewhere, or once the media
 * query stops matching, it reports null and the frame is the reader's alone.
 */
import type { MotionTools } from "../../../scripts/motion";

/**
 * Where the frame follows the scroll. Under 1024px there is too little width to
 * show the narrowing; under 700px tall the frame is never mostly on screen while
 * it narrows. landing-responsive.css reserves the figure's height under the same query.
 */
export const FOLLOW_MEDIA = "(min-width: 1024px) and (min-height: 700px)";

/**
 * Progress 0 when the figure's top is 70% down the viewport, 1 when it is 12%
 * down. With the holds in frame-scroll.ts the frame is at its narrowest while
 * its top is still a fifth of the way down, so the compact layout arrives with
 * the whole chart on screen and clear of the sticky header.
 */
const START = "top 70%";
const END = "top 12%";

/** How long the page's height must hold still before the trigger re-measures. */
const REFRESH_AFTER_MS = 200;

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
    const stopWatching = refreshOnPageHeightChange(() => ScrollTrigger.refresh());
    return () => {
      stopWatching();
      onProgress(null);
    };
  });
  return () => media.revert();
}

/**
 * Calls `refresh` once the document's height has changed and settled. Islands
 * above the section hydrate and fonts load after the trigger measures, which
 * moves the figure; ScrollTrigger only re-measures on a window resize.
 */
function refreshOnPageHeightChange(refresh: () => void): () => void {
  let height = document.body.scrollHeight;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver(() => {
    const next = document.body.scrollHeight;
    if (next === height) return;
    height = next;
    clearTimeout(timer);
    timer = setTimeout(refresh, REFRESH_AFTER_MS);
  });
  observer.observe(document.body);
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}
