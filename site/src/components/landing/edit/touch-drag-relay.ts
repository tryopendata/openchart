/**
 * Keeps a touch drag of the callout alive. Workaround for a library bug.
 *
 * The library's drag handler follows a touch with `touchmove` and `touchend`
 * listeners on `document`. A touch always reports to the element it started on,
 * and a finger on the callout starts on one of its `<tspan>`s. The drag preview
 * (`updateAnnotationGeometry` in packages/vanilla) rebuilds those tspans on the
 * first move, so every later touch event fires on a detached node, never
 * reaches `document`, and the drag stalls after one frame. A mouse drag is
 * unaffected: each mouse event is hit-tested afresh.
 *
 * This relays the touch events from the detached node to `document`, where the
 * library's listeners pick them up as if they had bubbled. It does nothing while
 * the node is still in the page. Remove it once the library keeps the label's
 * text nodes during a drag preview.
 */

/** The callout's text, whose children the drag preview replaces. */
const LABEL_SELECTOR = ".oc-annotation-label";
const FOLLOW_EVENTS = ["touchmove", "touchend", "touchcancel"] as const;

/** A copy of `event` that can be dispatched again. */
function copyTouchEvent(event: TouchEvent): TouchEvent {
  return new TouchEvent(event.type, {
    bubbles: true,
    cancelable: event.cancelable,
    touches: [...event.touches],
    targetTouches: [...event.targetTouches],
    changedTouches: [...event.changedTouches],
  });
}

/** Follows one touch that started on a callout label until it ends. */
function relayTouch(start: TouchEvent): void {
  const origin = start.target;
  if (!(origin instanceof Element) || !origin.closest(LABEL_SELECTOR)) return;
  const relay = (event: Event) => {
    const touch = event as TouchEvent;
    if (touch.type !== "touchmove") stopRelaying();
    if (origin.isConnected) return;
    if (touch.cancelable) touch.preventDefault();
    document.dispatchEvent(copyTouchEvent(touch));
  };
  const stopRelaying = () => {
    for (const type of FOLLOW_EVENTS) origin.removeEventListener(type, relay);
  };
  for (const type of FOLLOW_EVENTS) origin.addEventListener(type, relay, { passive: false });
}

/** Relays touches that start on a callout inside `root`; returns the teardown. */
export function relayDetachedTouches(root: HTMLElement): () => void {
  root.addEventListener("touchstart", relayTouch, { capture: true, passive: true });
  return () => root.removeEventListener("touchstart", relayTouch, { capture: true });
}
