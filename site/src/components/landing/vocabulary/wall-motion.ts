/**
 * The wall's page-level choreography, run only when `withMotion` allows it.
 * GSAP never touches a chart: each tile's rule draws across and its name lifts
 * in while the chart inside plays the library's own entrance. A refile moves the
 * tiles that stay with Flip and draws in the ones that arrive.
 */
import type { MotionTools } from "../../../scripts/motion";

const RULE = ".wall-rule";
const NAME = ".wall-name";
/** Soft and decisive: fast out of the gate, no overshoot. */
const EASE_RULE = "expo.out";
const EASE_NAME = "power3.out";
/** The wave's step between tiles, in seconds. */
const WAVE_STEP = 0.04;
/** Refile timing: at most 450ms, staggered by no more than 20ms. */
const REFILE_SECONDS = 0.45;
const REFILE_STEP = 0.015;

const partsOf = (tiles: Element[], selector: string) =>
  tiles.flatMap((tile) => [...tile.querySelectorAll(selector)]);

/** Draws in the rules and names of `tiles`, in reading order. Flip adds the returned timeline to its own. */
function drawIn(gsap: MotionTools["gsap"], tiles: Element[], step: number) {
  return gsap
    .timeline()
    .fromTo(
      partsOf(tiles, RULE),
      { scaleX: 0 },
      { scaleX: 1, duration: 0.8, ease: EASE_RULE, stagger: step, transformOrigin: "0 50%" },
      0,
    )
    .fromTo(
      partsOf(tiles, NAME),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.5, ease: EASE_NAME, stagger: step },
      0.12,
    );
}

/**
 * Sets every tile's rule and name to their start state, then draws each row in
 * as it scrolls into view, once. Tiles the filter hides wait until shown.
 */
export function waveIn({ gsap, ScrollTrigger }: MotionTools, tiles: HTMLElement[]): void {
  // Tiles the reader has already scrolled past stay as they are: no trigger would bring them back.
  const ahead = tiles.filter((tile) => tile.getBoundingClientRect().bottom > 0);
  if (ahead.length === 0) return;
  gsap.set(partsOf(ahead, RULE), { scaleX: 0, transformOrigin: "0 50%" });
  gsap.set(partsOf(ahead, NAME), { opacity: 0, y: 8 });
  ScrollTrigger.batch(ahead, {
    start: "top 92%",
    once: true,
    onEnter: (batch) => drawIn(gsap, batch, WAVE_STEP),
  });
}

/**
 * Applies a filter change with Flip: `apply` shows and hides tiles, the tiles
 * that stay glide to their new cells, and the ones that arrive draw in.
 * Returns the Flip timeline so a later refile can stop this one.
 */
export function refile(
  { gsap, Flip, ScrollTrigger }: MotionTools,
  tiles: HTMLElement[],
  apply: () => void,
) {
  const state = Flip.getState(tiles);
  apply();
  return Flip.from(state, {
    duration: REFILE_SECONDS,
    ease: EASE_NAME,
    stagger: REFILE_STEP,
    onEnter: (arriving) => drawIn(gsap, arriving, REFILE_STEP),
    // The wall's height changed, so every trigger below it moved.
    onComplete: () => ScrollTrigger.refresh(),
  });
}
