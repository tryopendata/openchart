/**
 * Listens for install copy clicks, docs clicks and the first figure interaction
 * in each landing section so the page can send those actions to analytics.
 */
import type { track } from "../lib/analytics";
import { Events } from "../lib/events";
import { demoInteractedProps, docsLinkProps, installCopiedProps } from "./landing-event-props";

/** Keys that move past a control or only modify another key. */
const PASSING_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "Escape"]);

/** Listens for landing interactions and returns a function to remove the listeners. */
export function watchLandingEvents(root: Document, send: typeof track): () => void {
  const interactedSections = new Set<string>();

  function onClick({ target }: MouseEvent) {
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-copy-command]");
    const copied = button && installCopiedProps(button);
    if (copied) send(Events.installCopied, copied);

    const link = target.closest("a[href]");
    const docs = link instanceof HTMLAnchorElement && docsLinkProps(link);
    if (docs) send(Events.docsLinkClicked, docs);
  }

  function onDemoPress(event: Event) {
    const { target } = event;
    if (!(target instanceof Element)) return;
    // Moving focus through a figure is not using it.
    if (event instanceof KeyboardEvent && PASSING_KEYS.has(event.key)) return;
    const props = demoInteractedProps(target);
    if (!props || interactedSections.has(props.section)) return;
    interactedSections.add(props.section);
    send(Events.demoInteracted, props);
  }

  root.addEventListener("click", onClick);
  // Chart controls can stop presses from bubbling when they handle input.
  root.addEventListener("pointerdown", onDemoPress, true);
  root.addEventListener("keydown", onDemoPress, true);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("pointerdown", onDemoPress, true);
    root.removeEventListener("keydown", onDemoPress, true);
  };
}
