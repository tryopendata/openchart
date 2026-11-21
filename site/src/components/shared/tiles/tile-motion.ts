/**
 * A tile wall's page-level choreography, run only when motion is allowed. GSAP
 * never touches a chart: a tile's rule draws across and its name fades in while
 * the chart inside plays the library's own entrance. A refile is one beat: the
 * tiles that stay glide to their new cells while the ones that arrive draw in,
 * all on the same duration and curve. Each tile draws in once per arrival: the
 * scroll wave skips a tile a refile already drew. The page names the rule and
 * name elements inside its tiles (`TileParts`). The name only fades: it is
 * usually an inline link, which a transform would not move, and a transform on
 * a block around the tile's link would shrink the link's tile-wide box to it.
 */
import type { MotionTools } from "../../../scripts/motion";

/** Selectors for the parts of a tile that draw in: the ticked rule and the name. */
export type TileParts = { rule: string; name: string };

/** Soft and decisive: fast out of the gate, no overshoot. */
const EASE = "power3.out";
/** The scroll wave: a little slower, and staggered across the row. */
const WAVE = { seconds: 0.7, step: 0.04 } as const;
/** A refile: at most 450ms, staggered by no more than 20ms. */
const REFILE = { seconds: 0.45, step: 0.015 } as const;
/** How far below the viewport's top a tile starts its wave. */
const WAVE_START = "top 92%";

const partsOf = (tiles: Element[], selector: string) =>
  tiles.flatMap((tile) => [...tile.querySelectorAll(selector)]);

/** Tiles drawn in already, by the wave or a refile. */
const drawn = new WeakSet<Element>();

/** Draws in the rules and names of `tiles`, in reading order. Flip adds the returned timeline to its own. */
function drawIn(
  gsap: MotionTools["gsap"],
  tiles: Element[],
  parts: TileParts,
  timing: typeof WAVE | typeof REFILE,
) {
  for (const tile of tiles) drawn.add(tile);
  return gsap
    .timeline()
    .fromTo(
      partsOf(tiles, parts.rule),
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: timing.seconds,
        ease: EASE,
        stagger: timing.step,
        transformOrigin: "0 50%",
      },
      0,
    )
    .fromTo(
      partsOf(tiles, parts.name),
      { opacity: 0 },
      { opacity: 1, duration: timing.seconds, ease: EASE, stagger: timing.step },
      0,
    );
}

/**
 * Draws each row in as it scrolls into view, once. Only tiles still below the
 * viewport take the start state: a tile the reader can already see stays as it
 * is, and a tile the filter hides is left to the refile that shows it.
 */
export function waveIn(
  { gsap, ScrollTrigger }: MotionTools,
  tiles: HTMLElement[],
  parts: TileParts,
): void {
  const fold = window.innerHeight * 0.92;
  const below = tiles.filter(
    (tile) => !tile.hidden && !drawn.has(tile) && tile.getBoundingClientRect().top > fold,
  );
  if (below.length === 0) return;
  gsap.set(partsOf(below, parts.rule), { scaleX: 0, transformOrigin: "0 50%" });
  gsap.set(partsOf(below, parts.name), { opacity: 0 });
  ScrollTrigger.batch(below, {
    start: WAVE_START,
    once: true,
    onEnter: (batch) =>
      drawIn(
        gsap,
        batch.filter((tile) => !drawn.has(tile)),
        parts,
        WAVE,
      ),
  });
}

/** Ends any refile still running on `tiles`, at its final state. */
export function finishRefile({ Flip }: MotionTools, tiles: HTMLElement[]): void {
  Flip.killFlipsOf(tiles, true);
}

/**
 * Applies a filter change with Flip: `apply` shows and hides tiles, the tiles
 * that stay glide to their new cells, and the ones that arrive draw in. A refile
 * still running is finished first, so an interruption starts from settled cells.
 */
export function refile(
  tools: MotionTools,
  tiles: HTMLElement[],
  parts: TileParts,
  apply: () => void,
): void {
  const { gsap, Flip, ScrollTrigger } = tools;
  finishRefile(tools, tiles);
  const state = Flip.getState(tiles);
  apply();
  Flip.from(state, {
    duration: REFILE.seconds,
    ease: EASE,
    stagger: REFILE.step,
    onEnter: (arriving) => drawIn(gsap, arriving, parts, REFILE),
    // The wall's height changed, so every trigger below it moved.
    onComplete: () => ScrollTrigger.refresh(),
  });
}
