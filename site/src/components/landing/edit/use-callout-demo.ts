/**
 * When the edit section's self-demonstration runs, and when it stops for good.
 *
 * It plays once, the first time the figure is 60% visible with the live chart
 * mounted. The reader taking over ends it for the rest of the page view: a key
 * press in the figure, a mouse or pen press, or a touch that lands on the
 * callout or Reset. A touch anywhere else counts only once it ends as a tap; a
 * touch that turns into a scroll (the browser cancels it) leaves the
 * demonstration playing, so a phone reader scrolling past still sees it.
 *
 * Each step of the run is committed synchronously, so the chart always draws
 * the offset the island holds. Taking over then only stops the timeline: the
 * callout stays where it is and the reader's press acts on it, so a grab of the
 * moving callout drags it from there.
 */
import { type RefObject, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "../../../scripts/motion";
import { playCalloutDemo } from "./callout-demo";
import type { Offset } from "./callout-offset";

/** Share of the figure that must be on screen before the callout moves by itself. */
const VISIBLE_SHARE = 0.6;
/** Where a touch takes over at once: the callout and Reset. */
const TOUCH_TAKEOVER_SELECTOR = ".oc-annotation-text, .edit-reset";

/** What the demonstration hook needs from the island. */
export type CalloutDemoSetup = {
  /** An element inside the figure; the figure around it is watched. */
  root: RefObject<HTMLElement | null>;
  /** True once the live chart has replaced the static one. */
  live: boolean;
  from: Offset;
  to: Offset;
  /** Sets the callout's offset. */
  setOffset: (offset: Offset) => void;
};

/** True when a press should end the demonstration now rather than wait to see if it is a tap. */
function takesOverAtOnce(event: PointerEvent): boolean {
  if (event.pointerType !== "touch") return true;
  return event.target instanceof Element && event.target.closest(TOUCH_TAKEOVER_SELECTOR) !== null;
}

/** Runs the demonstration once; true while it is moving the callout. */
export function useCalloutDemo({ root, live, from, to, setOffset }: CalloutDemoSetup): boolean {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!live || !element || prefersReducedMotion()) return;
    const figure = element.closest("figure") ?? element;
    let stop: (() => void) | null = null;
    let finished = false;
    let pendingTap = false;

    const finish = () => {
      finished = true;
      observer.disconnect();
      figure.removeEventListener("pointerdown", onPointerDown, true);
      figure.removeEventListener("pointerup", onPointerUp, true);
      figure.removeEventListener("pointercancel", onPointerCancel, true);
      figure.removeEventListener("keydown", takeOver, true);
    };
    const takeOver = () => {
      const wasRunning = stop !== null;
      stop?.();
      stop = null;
      finish();
      // Synchronous, so the press that took over already sees the settled readout and Reset.
      if (wasRunning) flushSync(() => setRunning(false));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (takesOverAtOnce(event)) takeOver();
      else pendingTap = true;
    };
    const onPointerUp = () => {
      if (pendingTap) takeOver();
    };
    const onPointerCancel = () => {
      pendingTap = false;
    };
    const start = () => {
      observer.disconnect();
      stop = playCalloutDemo({
        from,
        to,
        onOffset: (offset) =>
          flushSync(() => {
            setRunning(true);
            setOffset(offset);
          }),
        onComplete: () => {
          stop = null;
          finish();
          setOffset(from);
          setRunning(false);
        },
        onStop: () => {
          // Reduced motion turned on mid-run: put the callout back where the spec has it.
          stop = null;
          finish();
          setOffset(from);
          setRunning(false);
        },
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.intersectionRatio >= VISIBLE_SHARE)) start();
      },
      { threshold: VISIBLE_SHARE },
    );

    observer.observe(figure);
    figure.addEventListener("pointerdown", onPointerDown, true);
    figure.addEventListener("pointerup", onPointerUp, true);
    figure.addEventListener("pointercancel", onPointerCancel, true);
    figure.addEventListener("keydown", takeOver, true);
    return () => {
      stop?.();
      if (!finished) finish();
    };
  }, [root, live, from, to, setOffset]);

  return running;
}
