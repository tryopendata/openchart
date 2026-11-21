/**
 * The spec pane's motion when a step lands: the pane scrolls so the first added
 * line is in view, and the added lines are written in left to right, their
 * accent rule uncovered with them. The whole beat, offset and stagger included,
 * takes at most 400ms however many lines the step adds, so it lands together
 * with the chart's own transition. GSAP drives it; without GSAP (reduced
 * motion, or before it loads) the pane only jumps to the added lines.
 */
import type { MotionTools } from "../../../scripts/motion";

/** Space kept above the first added line when the pane scrolls to it, in px. */
const SCROLL_MARGIN = 24;
/** Seconds. Scroll first, then lines: SCROLL_LEAD + STAGGER_TOTAL + LINE_SECONDS stays within 0.4. */
const SCROLL_SECONDS = 0.32;
const SCROLL_LEAD = 0.06;
const STAGGER_TOTAL = 0.08;
const LINE_SECONDS = 0.26;
const EASE = "power3.out";

/**
 * The scrollTop that brings the added block into view (its first line near the
 * top when the block is taller than the pane), or null when all of it shows.
 */
function scrollTarget(pane: HTMLElement, first: HTMLElement, last: HTMLElement): number | null {
  const top = first.offsetTop - SCROLL_MARGIN;
  const bottom = last.offsetTop + last.offsetHeight + SCROLL_MARGIN;
  const visible = top >= pane.scrollTop && bottom <= pane.scrollTop + pane.clientHeight;
  if (visible) return null;
  const fits = bottom - top <= pane.clientHeight;
  return Math.max(0, fits && top > pane.scrollTop ? bottom - pane.clientHeight : top);
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
  const last = lines.at(-1);
  if (!first || !last) return () => {};
  const target = scrollTarget(pane, first, last);
  if (!tools) {
    if (target !== null) pane.scrollTop = target;
    return () => {};
  }
  const { gsap } = tools;
  const timeline = gsap.timeline({ defaults: { ease: EASE } });
  if (target !== null) timeline.to(pane, { scrollTop: target, duration: SCROLL_SECONDS }, 0);
  timeline.fromTo(
    lines,
    { clipPath: "inset(0 100% 0 0)" },
    {
      clipPath: "inset(0 0% 0 0)",
      duration: LINE_SECONDS,
      stagger: { amount: STAGGER_TOTAL },
      clearProps: "clipPath",
    },
    target === null ? 0 : SCROLL_LEAD,
  );
  return () => {
    timeline.progress(1).kill();
  };
}
