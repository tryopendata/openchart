/**
 * Monotonic SVG ID generator shared by gradient and clipPath defs.
 *
 * Why a single counter: SVG `url(#id)` references resolve against the full
 * document, so any ID collision (across charts on the same page) silently
 * cross-wires one chart's fill/clip into another. Random-hex suffixes have a
 * small-but-real collision probability that surfaced in production; a global
 * monotonic counter makes uniqueness unconditional.
 *
 * Gradient and clip-path IDs share one counter so we can't regress one half of
 * the system by accident. Consumers just pick a prefix.
 */

let counter = 0;

export function nextSvgId(prefix: string): string {
  return `${prefix}-${counter++}`;
}

/**
 * Reset the counter. Intended for isolated test runs only - production code
 * should never call this. The underscore prefix marks it as non-public.
 */
export function _resetSvgIdCounter(): void {
  counter = 0;
}
