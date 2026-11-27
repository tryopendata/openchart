/**
 * Keeps a section the reader arrived at by link (`/#motion`) in place while the
 * page settles. Sections above it grow as their islands hydrate, so the
 * browser's one scroll to the hash ends well short of the target. Until the
 * reader scrolls or presses something, each change in the page's height puts
 * the target back at the top.
 */

/** Input that means the reader has taken the scroll position over. */
const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** After this long with no change in height the page has settled. */
const SETTLED_MS = 4000;

/** Starts holding the hash's target in view; the returned function stops it. */
export function holdHashTarget(root: Document): () => void {
  const view = root.defaultView;
  const id = decodeURIComponent(root.location.hash.slice(1));
  const target = id ? root.getElementById(id) : null;
  if (!view || !target || typeof view.ResizeObserver !== "function") return () => {};

  let settled: ReturnType<typeof setTimeout> | undefined;
  const observer = new view.ResizeObserver(() => {
    target.scrollIntoView({ block: "start", behavior: "instant" });
    clearTimeout(settled);
    settled = setTimeout(stop, SETTLED_MS);
  });
  function stop() {
    observer.disconnect();
    clearTimeout(settled);
    for (const type of READER_INPUT) view?.removeEventListener(type, stop, true);
  }
  for (const type of READER_INPUT)
    view.addEventListener(type, stop, { capture: true, passive: true });
  observer.observe(root.body);
  return stop;
}
