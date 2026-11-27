/**
 * Re-measures every ScrollTrigger on the page when the page's height changes.
 * Islands hydrate and fonts load after triggers measure, which moves what they
 * watch (the styles pin, the responsive frame), and ScrollTrigger re-measures
 * on its own only on a window resize. `withMotion` starts one watcher per page
 * the first time it hands out tools; it runs for the life of the page, so a
 * page restored from the back/forward cache keeps it.
 */
import type { MotionTools } from "./index";

/** How long the page's height must hold still before the triggers re-measure. */
export const REFRESH_AFTER_MS = 200;

let started = false;

/** Starts the page's one height watcher, refreshing `ScrollTrigger`; later calls do nothing. */
export function startPageHeightRefresh({ ScrollTrigger }: MotionTools): void {
  if (started || typeof ResizeObserver !== "function") return;
  started = true;
  // The safe refresh waits for any scroll in progress to end: a refresh puts the scroll back
  // where it recorded it, which would cut short a smooth scroll (a link, scrollTo) mid-way.
  refreshOnPageHeightChange(document, () => ScrollTrigger.refresh(true));
}

/**
 * Calls `refresh` once `root`'s body height has changed and then held still for
 * REFRESH_AFTER_MS. Returns the function that stops watching.
 */
export function refreshOnPageHeightChange(root: Document, refresh: () => void): () => void {
  let height = root.body.scrollHeight;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver(() => {
    const next = root.body.scrollHeight;
    if (next === height) return;
    height = next;
    clearTimeout(timer);
    timer = setTimeout(refresh, REFRESH_AFTER_MS);
  });
  observer.observe(root.body);
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}
