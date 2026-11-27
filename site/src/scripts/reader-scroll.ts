/**
 * Tells a scroll the reader made from one the page made. The landing page moves
 * the scroll itself (the hash holder puts a linked section back in view, the
 * browser restores the position on a reload), and code that waits for the
 * reader (the hash holder letting go, the responsive frame starting to follow)
 * must not mistake those for the reader. Page code scrolls through
 * `scrollByPage`, so every watcher learns where the page put the scroll; any
 * other position, or a scroll after the reader's own input, is the reader's.
 */

/** Input that means the reader has taken the scroll position over. */
export const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** Scroll positions closer than this are the same position (scrollY can be fractional when zoomed). */
const SAME_POSITION_PX = 1;

/**
 * Told that the page has just scrolled. With no argument the scroll is where the
 * page put it; with `movedBy` the page moved it that far from wherever it was,
 * which leaves a reader's scroll not yet reported still counted as theirs.
 */
type PageScrollListener = (movedBy?: number) => void;

/** Watchers per window, told each time the page scrolls. */
const pageScrollListeners = new WeakMap<Window, Set<PageScrollListener>>();

/** True when the browser restores the scroll position for this navigation (a reload, back or forward). */
export function navigationRestoresScroll(view: Window): boolean {
  const [entry] = view.performance?.getEntriesByType?.("navigation") ?? [];
  const type = (entry as PerformanceNavigationTiming | undefined)?.type;
  return type === "reload" || type === "back_forward";
}

/** Runs `scroll`, a scroll the page makes, and tells every watcher in `view` where it left the scroll. */
export function scrollByPage(view: Window, scroll: () => void): void {
  scroll();
  for (const listener of pageScrollListeners.get(view) ?? []) listener();
}

/**
 * Tells every watcher in `view` that the page moved the scroll by `movedBy` px
 * from where it was (a ScrollTrigger refresh re-applying the position on a page
 * whose height changed), without claiming the position it started from.
 */
export function scrollMovedByPage(view: Window, movedBy: number): void {
  for (const listener of pageScrollListeners.get(view) ?? []) listener(movedBy);
}

/** Calls `listener` on each of the reader's input events in `view`. Returns the function that stops. */
export function onReaderInput(view: Window, listener: () => void): () => void {
  for (const type of READER_INPUT)
    view.addEventListener(type, listener, { capture: true, passive: true });
  return () => {
    for (const type of READER_INPUT) view.removeEventListener(type, listener, true);
  };
}

/**
 * Calls `onReaderScroll` once, on the first scroll event the reader caused: one
 * after the reader's input, or one that leaves the scroll somewhere the page did
 * not put it. Two other kinds of scroll count as the page's: the browser's
 * scroll anchoring keeping the view steady as content above grows or shrinks
 * (which can arrive before the page's own correction), and one while the
 * browser restores the position (before load and the frames after it, on a
 * reload or back/forward). Anchoring never moves the scroll further than the
 * content above it grew, so with an `anchor` a scroll no larger than the change
 * in the anchor's place in the document passes (anchoring may steady another
 * element and leave the anchor part of the way). Without one, any scroll no
 * larger than the change in the page's height passes, which can also swallow a
 * reader's scroll made while content below grows. Returns the function that
 * stops watching.
 */
export function whenReaderScrolls(
  view: Window,
  onReaderScroll: () => void,
  anchor?: Element,
): () => void {
  const pageHeight = () => view.document.documentElement.scrollHeight;
  /** The anchor's distance from the top of the document, which only content above it changes. */
  const anchorOffset = () => (anchor?.getBoundingClientRect().top ?? 0) + view.scrollY;
  let expected = view.scrollY;
  let expectedHeight = pageHeight();
  let expectedAnchorOffset = anchorOffset();
  let readerActed = false;
  let restoring = navigationRestoresScroll(view) && view.document.readyState !== "complete";

  const acceptPosition = (movedBy?: number) => {
    if (movedBy !== undefined) {
      // Only the position moves: the height and the anchor's place stay as last seen, so growth
      // that arrived with the page's move still explains the scroll event that reports it.
      expected += movedBy;
      return;
    }
    expected = view.scrollY;
    expectedHeight = pageHeight();
    expectedAnchorOffset = anchorOffset();
  };

  const anchoringMovedIt = () => {
    const grew = anchor
      ? Math.abs(anchorOffset() - expectedAnchorOffset)
      : Math.abs(pageHeight() - expectedHeight);
    return Math.abs(view.scrollY - expected) < SAME_POSITION_PX + grew;
  };
  const pageMovedIt = () =>
    Math.abs(view.scrollY - expected) < SAME_POSITION_PX || anchoringMovedIt() || restoring;

  const onScroll = () => {
    if (!readerActed && pageMovedIt()) {
      acceptPosition();
      return;
    }
    stop();
    onReaderScroll();
  };
  const onLoad = () => {
    // The restored position's scroll event arrives in a frame after load.
    view.requestAnimationFrame(() =>
      view.requestAnimationFrame(() => {
        restoring = false;
      }),
    );
  };
  const stopInput = onReaderInput(view, () => {
    readerActed = true;
  });

  const listeners = pageScrollListeners.get(view) ?? new Set<PageScrollListener>();
  pageScrollListeners.set(view, listeners);
  listeners.add(acceptPosition);
  view.addEventListener("scroll", onScroll, { passive: true });
  if (restoring) view.addEventListener("load", onLoad, { once: true });

  function stop() {
    listeners.delete(acceptPosition);
    view.removeEventListener("scroll", onScroll);
    view.removeEventListener("load", onLoad);
    stopInput();
  }
  return stop;
}
