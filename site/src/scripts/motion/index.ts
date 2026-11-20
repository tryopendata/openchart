/**
 * The landing page's one way into GSAP. Sections call `withMotion` to build
 * their timelines; it registers ScrollTrigger, Flip and Draggable once, runs
 * nothing for readers who asked for reduced motion (they get the final state),
 * and returns a teardown that reverts everything `setup` created, ScrollTriggers
 * included. The library's own transitions animate charts; GSAP only sequences
 * the page. Lane 2/a implements it; the scaffold fixes the signature.
 */
import type { gsap } from "gsap";
import type { Draggable } from "gsap/Draggable";
import type { Flip } from "gsap/Flip";
import type { ScrollTrigger } from "gsap/ScrollTrigger";

/** What `setup` receives: GSAP and its plugins, already registered. */
export type MotionTools = {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
  Flip: typeof Flip;
  Draggable: typeof Draggable;
};

/** Runs `setup` only when the reader has not asked for reduced motion, with GSAP's plugins registered once. Returns a function that reverts everything `setup` created. */
// biome-ignore lint/suspicious/noConfusingVoidType: the plan's contract lets setup return nothing or its own teardown, and a void arrow body must type-check.
export function withMotion(setup: (tools: MotionTools) => void | (() => void)): () => void {
  throw new Error(
    `withMotion is not implemented yet (setup ${setup.name || "anonymous"}): lane 2/a implements site/src/scripts/motion/index.ts.`,
  );
}
