/**
 * The spec pane's motion when a step lands: the pane scrolls so the first added
 * line is in view, and the added lines are written in left to right with their
 * accent rule drawing down beside them. GSAP drives it; without GSAP (reduced
 * motion, or before it loads) the pane only jumps to the added lines.
 */
import type { MotionTools } from "../../../scripts/motion";

/** Space kept above the first added line when the pane scrolls to it, in px. */
const SCROLL_MARGIN = 24;
const REVEAL_SECONDS = 0.4;
/** Stagger between lines, kept small so a long step still lands within about 600ms. */
const LINE_STAGGER = 0.012;

/** The scrollTop that brings the first added line near the top, or null when it already shows. */
function scrollTarget(pane: HTMLElement, first: HTMLElement): number | null {
  const top = first.offsetTop - SCROLL_MARGIN;
  const visible =
    top >= pane.scrollTop &&
    first.offsetTop + first.offsetHeight <= pane.scrollTop + pane.clientHeight;
  return visible ? null : Math.max(0, top);
}

/** Lines the current step added, in order. */
const addedLines = (pane: HTMLElement) => [
  ...pane.querySelectorAll<HTMLElement>("[data-spec-added]"),
];

/**
 * Shows the step's added lines. Returns a function that stops the animation,
 * leaving the lines in their final state.
 */
export function revealAddedLines(pane: HTMLElement, tools: MotionTools | null): () => void {
  const lines = addedLines(pane);
  const first = lines[0];
  if (!first) return () => {};
  const target = scrollTarget(pane, first);
  if (!tools) {
    if (target !== null) pane.scrollTop = target;
    return () => {};
  }
  const { gsap } = tools;
  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (target !== null) timeline.to(pane, { scrollTop: target, duration: 0.5 }, 0);
  timeline.fromTo(
    lines,
    { clipPath: "inset(0 100% 0 0)" },
    {
      clipPath: "inset(0 0% 0 0)",
      duration: REVEAL_SECONDS,
      stagger: LINE_STAGGER,
      clearProps: "clipPath",
    },
    target === null ? 0 : 0.12,
  );
  return () => {
    timeline.progress(1).kill();
  };
}
