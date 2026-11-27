/**
 * Keeps a section the reader arrived at by link (`/#motion`) in place while the
 * page settles. Sections above it grow as their islands hydrate, so the
 * browser's one scroll to the hash ends well short of the target. Until the
 * reader scrolls (reader-scroll.ts tells their scrolls from the page's), each
 * change in the page's height puts the target back at the top. A reload or a
 * back/forward navigation is left to the browser's scroll restoration.
 */
import {
  navigationRestoresScroll,
  onReaderInput,
  scrollByPage,
  whenReaderScrolls,
} from "./reader-scroll";

/** After this long with no change in height the page has settled. */
const SETTLED_MS = 4000;
/** The hold ends after this long however often the height changes, so a page that keeps growing never traps the scroll. */
const LONGEST_HOLD_MS = 12_000;

/** The element the URL's hash names, or null when there is none or the hash is not valid percent-encoding. */
function hashTarget(root: Document): HTMLElement | null {
  let id: string;
  try {
    id = decodeURIComponent(root.location.hash.slice(1));
  } catch (error) {
    // A malformed hash (`#%E0%A4`) names no section: there is nothing to hold.
    if (error instanceof URIError) return null;
    throw error;
  }
  return id ? root.getElementById(id) : null;
}

/** Starts holding the hash's target in view; the returned function stops it. */
export function holdHashTarget(root: Document): () => void {
  const view = root.defaultView;
  const target = hashTarget(root);
  if (!view || !target || typeof view.ResizeObserver !== "function") return () => {};
  if (navigationRestoresScroll(view)) return () => {};

  const putTargetAtTop = () =>
    scrollByPage(view, () => target.scrollIntoView({ block: "start", behavior: "instant" }));

  let settled: ReturnType<typeof setTimeout> | undefined;
  const longest = setTimeout(stop, LONGEST_HOLD_MS);
  const observer = new view.ResizeObserver(() => {
    putTargetAtTop();
    clearTimeout(settled);
    settled = setTimeout(stop, SETTLED_MS);
  });
  // The reader's input stops the hold at once, before a resize could fight a scroll they started.
  const stopInput = onReaderInput(view, stop);
  // Scrolls with no input event (a scrollbar drag, assistive technology) show up as a position the page did not set.
  const stopScrollWatch = whenReaderScrolls(view, stop, target);
  putTargetAtTop();
  observer.observe(root.body);

  function stop() {
    observer.disconnect();
    clearTimeout(settled);
    clearTimeout(longest);
    stopInput();
    stopScrollWatch();
  }
  return stop;
}
