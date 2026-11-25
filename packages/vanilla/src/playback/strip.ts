/**
 * The controls strip slot that chart and map playback mount below their SVG: creating it,
 * keeping it directly under a re-rendered SVG, and the height it takes from the host's box.
 */
import { PLAYBACK_CONTROLS_HEIGHT } from './controls';

/** Class on the slot the controls strip mounts into. */
const STRIP_SLOT_CLASS = 'oc-playback-strip';

/** Fewer periods than this leave nothing to play: the strip hides and play() does nothing. */
const MIN_PLAYABLE_PERIODS = 2;

/** Whether a run with `periodCount` periods has anything to play. */
export function isPlayable(periodCount: number): boolean {
  return periodCount >= MIN_PLAYABLE_PERIODS;
}

/**
 * Height the strip takes below the SVG: 0 for a spec that doesn't play or turns the
 * controls off.
 */
export function stripHeight(plays: boolean, playback: unknown): number {
  if (!plays) return 0;
  const controls = (playback as { controls?: unknown } | undefined)?.controls;
  return controls === false ? 0 : PLAYBACK_CONTROLS_HEIGHT;
}

/** Options for placing the strip under one rendered SVG. */
export interface StripPlacement {
  /** The current slot, or null when none has been created. */
  slot: HTMLElement | null;
  svg: SVGElement;
  /** `timing.controls`: false drops the slot. */
  controls: boolean;
  periodCount: number;
  darkMode: boolean;
}

function createStripSlot(doc: Document): HTMLElement {
  const slot = doc.createElement('div');
  slot.className = STRIP_SLOT_CLASS;
  slot.style.height = `${PLAYBACK_CONTROLS_HEIGHT}px`;
  return slot;
}

/**
 * Create, keep or drop the strip slot to match `controls`, directly below `svg`. Returns
 * the slot now in use, or null when controls are off.
 */
export function placeStrip(placement: StripPlacement): HTMLElement | null {
  const { svg } = placement;
  if (!placement.controls) {
    placement.slot?.remove();
    return null;
  }
  const slot = placement.slot ?? createStripSlot(svg.ownerDocument);
  // Move the fresh SVG rather than the strip, so focus inside the strip survives a re-render.
  if (!slot.isConnected) svg.after(slot);
  else if (svg.nextSibling !== slot) slot.before(svg);
  slot.classList.toggle('oc-dark', placement.darkMode);
  // A single period keeps the strip's height reserved so the layout doesn't jump when a
  // later update brings a second period.
  slot.style.visibility = isPlayable(placement.periodCount) ? '' : 'hidden';
  return slot;
}
