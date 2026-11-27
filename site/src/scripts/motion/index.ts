/**
 * The landing page's one way into GSAP. Sections call `withMotion` to build
 * their timelines; it registers ScrollTrigger, Flip and Draggable once, runs
 * nothing for readers who asked for reduced motion (they get the final state),
 * and returns a teardown that reverts everything `setup` created, ScrollTriggers
 * included. The library's own transitions animate charts; GSAP only sequences
 * the page.
 *
 * GSAP loads lazily, so `setup` runs a moment after the call, inside a
 * `gsap.matchMedia()` context: if the reader turns on reduced motion later,
 * everything `setup` made is reverted then too. The first time tools are handed
 * out, a page-wide watcher starts that re-measures every ScrollTrigger when the
 * page's height changes (page-height-refresh.ts).
 */
import type { gsap } from "gsap";
import type { Draggable } from "gsap/Draggable";
import type { Flip } from "gsap/Flip";
import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { startPageHeightRefresh } from "./page-height-refresh";
import { MOTION_OK_QUERY, prefersReducedMotion } from "./reduced";
import { loadMotionTools } from "./register";

export { prefersReducedMotion } from "./reduced";

/** What `setup` receives: GSAP and its plugins, already registered. */
export type MotionTools = {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
  Flip: typeof Flip;
  Draggable: typeof Draggable;
};

/**
 * Runs `setup` only when the reader has not asked for reduced motion, with GSAP's plugins registered once. Returns a function that reverts everything `setup` created.
 * If GSAP fails to load, one console error names the section by `setup.name`.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: the plan's contract lets setup return nothing or its own teardown, and a void arrow body must type-check.
export function withMotion(setup: (tools: MotionTools) => void | (() => void)): () => void {
  if (prefersReducedMotion()) return () => {};
  let reverted = false;
  let revert = () => {};
  loadMotionTools().then(
    (tools) => {
      if (reverted) return;
      startPageHeightRefresh(tools);
      const media = tools.gsap.matchMedia();
      media.add(MOTION_OK_QUERY, () => setup(tools));
      revert = () => media.revert();
    },
    (error: unknown) => {
      // Motion is decoration: the page already shows its final state, so report and go on.
      console.error(
        `withMotion: GSAP failed to load, so ${setup.name || "a section"} shows its final state without motion.`,
        error,
      );
    },
  );
  return () => {
    reverted = true;
    revert();
  };
}
