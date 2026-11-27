/**
 * When the edit section's self-demonstration runs, and when it stops for good.
 *
 * It plays once, the first time the figure is 60% visible with the live chart
 * mounted. The reader's first pointer or key press anywhere in the figure ends
 * it for the rest of the page view: a run in progress is killed and the callout
 * snaps back to its starting offset synchronously, before the library handles
 * that same press, so a nudge starts from where the spec put the callout. A
 * press before the run starts cancels it outright.
 */
import { type RefObject, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "../../../scripts/motion";
import { playCalloutDemo } from "./callout-demo";
import type { Offset } from "./callout-offset";

/** Share of the figure that must be on screen before the callout moves by itself. */
const VISIBLE_SHARE = 0.6;
/** The presses that count as the reader taking over. */
const TAKEOVER_EVENTS = ["pointerdown", "keydown"] as const;

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

/** Runs the demonstration once; true while it is moving the callout. */
export function useCalloutDemo({ root, live, from, to, setOffset }: CalloutDemoSetup): boolean {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!live || !element || prefersReducedMotion()) return;
    const figure = element.closest("figure") ?? element;
    let stop: (() => void) | null = null;
    let finished = false;

    const finish = () => {
      finished = true;
      observer.disconnect();
      for (const type of TAKEOVER_EVENTS) figure.removeEventListener(type, takeOver, true);
    };
    const takeOver = () => {
      const wasRunning = stop !== null;
      stop?.();
      stop = null;
      finish();
      if (!wasRunning) return;
      flushSync(() => {
        setRunning(false);
        setOffset(from);
      });
    };
    const start = () => {
      observer.disconnect();
      stop = playCalloutDemo({
        from,
        to,
        onOffset: (offset) => {
          setRunning(true);
          setOffset(offset);
        },
        onComplete: () => {
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
    for (const type of TAKEOVER_EVENTS) figure.addEventListener(type, takeOver, true);
    return () => {
      stop?.();
      if (!finished) finish();
    };
  }, [root, live, from, to, setOffset]);

  return running;
}
