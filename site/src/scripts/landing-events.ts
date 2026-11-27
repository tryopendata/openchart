/**
 * The landing page's analytics events: an install command copied, a docs link
 * followed, and the first use of each section's demo. Delegated listeners on
 * the document; what qualifies and what each event says is in
 * landing-event-props.ts.
 */
import type { track } from "../lib/analytics";
import { Events } from "../lib/events";
import { demoInteractedProps, docsLinkProps, installCopiedProps } from "./landing-event-props";

/** Keys that move focus or the page, or only modify another key: none of them uses a control. */
const PASSING_KEYS = new Set([
  "Tab",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "Escape",
  "CapsLock",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function isPassingKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  return PASSING_KEYS.has(event.key) || /^F\d+$/.test(event.key);
}

/** Listens for landing interactions and returns a function to remove the listeners. */
export function watchLandingEvents(root: Document, send: typeof track): () => void {
  const interactedSections = new Set<string>();
  /** Touches that are down on a demo control and may still turn into a page scroll. */
  const touches = new Map<number, { section: string }>();

  // Copy buttons report the clipboard's answer, so a refused copy is not counted.
  function onCopy(event: Event) {
    const { target } = event;
    if (!(target instanceof Element) || !(event instanceof CustomEvent)) return;
    if (event.detail?.ok !== true) return;
    const copied = installCopiedProps(target);
    if (copied) send(Events.installCopied, copied);
  }

  // Counted however the link is opened: a new tab is still a reader going to the docs.
  function onClick({ target }: MouseEvent) {
    if (!(target instanceof Element)) return;
    const link = target.closest("a[href]");
    const docs = link instanceof HTMLAnchorElement && docsLinkProps(link);
    if (docs) send(Events.docsLinkClicked, docs);
  }

  function countDemo(props: { section: string }) {
    if (interactedSections.has(props.section)) return;
    interactedSections.add(props.section);
    send(Events.demoInteracted, props);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const props = demoInteractedProps(event.target);
    if (!props) return;
    // A finger may be starting a scroll: wait to see whether the browser takes the gesture.
    if (event.pointerType === "touch") touches.set(event.pointerId, props);
    else countDemo(props);
  }

  function onPointerUp(event: PointerEvent) {
    const props = touches.get(event.pointerId);
    touches.delete(event.pointerId);
    if (props) countDemo(props);
  }

  function onPointerCancel(event: PointerEvent) {
    touches.delete(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!(event.target instanceof Element) || isPassingKey(event)) return;
    const props = demoInteractedProps(event.target);
    if (props) countDemo(props);
  }

  // Captured, because chart controls can stop a press from bubbling when they handle it.
  const captured = [
    ["pointerdown", onPointerDown],
    ["pointerup", onPointerUp],
    ["pointercancel", onPointerCancel],
    ["keydown", onKeyDown],
  ] as const;
  root.addEventListener("sf:copy", onCopy);
  root.addEventListener("click", onClick);
  for (const [type, listener] of captured) {
    root.addEventListener(type, listener as EventListener, true);
  }
  return () => {
    root.removeEventListener("sf:copy", onCopy);
    root.removeEventListener("click", onClick);
    for (const [type, listener] of captured) {
      root.removeEventListener(type, listener as EventListener, true);
    }
  };
}
