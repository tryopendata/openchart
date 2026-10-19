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
let idPrefix = '';

/** @internal Preserve the live document generator while static rendering is scoped. */
export function captureSvgIdState(): { counter: number; prefix: string } {
  return { counter, prefix: idPrefix };
}
/** @internal */
export function restoreSvgIdState(state: { counter: number; prefix: string }): void {
  counter = state.counter;
  idPrefix = state.prefix;
}

export function nextSvgId(prefix: string): string {
  return `${idPrefix}${prefix}-${counter++}`;
}

/** @internal Used by static rendering only. Never call from browser-facing code. */
export function resetSvgIdCounter(prefix = ''): void {
  counter = 0;
  idPrefix = prefix ? `${prefix}-` : '';
}
