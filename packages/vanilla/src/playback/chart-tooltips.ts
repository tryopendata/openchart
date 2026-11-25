/**
 * Hover tooltips for a playback chart's keyed marks. Content comes from `playbackTooltip`
 * at the current playhead, so an open tooltip follows the frame as playback moves.
 */
import type { TooltipContent } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import type { HoverEmphasis } from '../interactions/hover-emphasis';
import type { TooltipManager } from '../tooltip';
import { playbackTooltip } from './tooltip';

/** Where the tooltips read the playback and the playhead, and where they draw. */
export interface PlaybackTooltipOptions {
  svg: SVGElement;
  tooltips: TooltipManager;
  emphasis?: HoverEmphasis;
  /** The playback the SVG was rendered from; null once playback is torn down. */
  playback(): ChartPlayback | null;
  playhead(): number;
}

/** Live tooltip wiring for one rendered SVG. */
export interface PlaybackTooltips {
  /** Re-read the open tooltip at the current playhead. Does nothing when none is open. */
  refresh(): void;
  /** Remove the listeners and hide the tooltip. */
  dispose(): void;
}

interface HoverTarget {
  element: Element;
  key: string;
  x: number;
  y: number;
}

/** Key prefix of the playback's overlay text marks (period label and name labels). */
const OVERLAY_KEY_PREFIX = 'oc-playback-';
/** Key prefix of a name label; the rest of the key is its point's key. */
const NAME_LABEL_KEY_PREFIX = 'oc-playback-label|';

/**
 * The point mark an event target stands for: the keyed mark it's in, or the point a name
 * label names. Other overlays (the period label) stand for no mark. CSS already makes the
 * overlays inert to the pointer; this keeps them so where that CSS isn't loaded.
 */
function keyedMark(svg: SVGElement, target: EventTarget | null): Element | null {
  const element = target instanceof Element ? target.closest('[data-key]') : null;
  const key = element?.getAttribute('data-key');
  if (!element || !key?.startsWith(OVERLAY_KEY_PREFIX)) return element ?? null;
  if (!key.startsWith(NAME_LABEL_KEY_PREFIX)) return null;
  const pointKey = key.slice(NAME_LABEL_KEY_PREFIX.length);
  return svg.querySelector(`[data-key="${CSS.escape(pointKey)}"]`);
}

/**
 * Show each `[data-key]` mark's observed values on hover and touch, read at the playhead
 * when shown and again on every `refresh()`.
 */
export function wirePlaybackTooltips(options: PlaybackTooltipOptions): PlaybackTooltips {
  const { svg, tooltips, emphasis } = options;
  let hovered: HoverTarget | null = null;

  function show(target: HoverTarget) {
    const playback = options.playback();
    if (!playback) return;
    hovered = target;
    const content = playbackTooltip(playback, target.key, options.playhead());
    tooltips.show(content, target.x, target.y);
  }

  function hoverAt(element: Element, clientX: number, clientY: number) {
    const key = element.getAttribute('data-key');
    if (!key) return;
    const box = svg.getBoundingClientRect();
    const enters = hovered?.element !== element;
    show({ element, key, x: clientX - box.left, y: clientY - box.top });
    if (enters) emphasis?.setMark(element);
  }

  function onPointerMove(event: Event) {
    const element = keyedMark(svg, event.target);
    const { clientX, clientY } = event as MouseEvent;
    if (element) hoverAt(element, clientX, clientY);
  }

  function onPointerOut(event: Event) {
    if (!hovered) return;
    const next = keyedMark(svg, (event as MouseEvent).relatedTarget);
    if (next === hovered.element) return;
    hovered = null;
    tooltips.hide();
    emphasis?.clear();
  }

  function onTouchStart(event: Event) {
    const touch = (event as TouchEvent).touches[0];
    const element = keyedMark(svg, event.target);
    if (touch && element) hoverAt(element, touch.clientX, touch.clientY);
  }

  svg.addEventListener('mouseover', onPointerMove);
  svg.addEventListener('mousemove', onPointerMove);
  svg.addEventListener('mouseout', onPointerOut);
  svg.addEventListener('touchstart', onTouchStart);

  return {
    refresh() {
      if (hovered) show(hovered);
    },
    dispose() {
      svg.removeEventListener('mouseover', onPointerMove);
      svg.removeEventListener('mousemove', onPointerMove);
      svg.removeEventListener('mouseout', onPointerOut);
      svg.removeEventListener('touchstart', onTouchStart);
      if (hovered) tooltips.hide();
      hovered = null;
    },
  };
}

/**
 * Tooltip descriptors whose lookups read a keyed mark's values at the playhead, for the
 * keyboard navigation that reads descriptors by `data-mark-id`. Marks without a `data-key`
 * element keep their base content.
 */
class PlaybackTooltipDescriptors extends Map<string, TooltipContent> {
  readonly #svg: SVGElement;
  readonly #read: (key: string) => TooltipContent | null;

  constructor(
    base: Map<string, TooltipContent>,
    svg: SVGElement,
    read: (key: string) => TooltipContent | null,
  ) {
    super(base);
    this.#svg = svg;
    this.#read = read;
  }

  override get(markId: string): TooltipContent | undefined {
    const element = this.#svg.querySelector(`[data-mark-id="${CSS.escape(markId)}"]`);
    const key = element?.getAttribute('data-key');
    return (key ? this.#read(key) : null) ?? super.get(markId);
  }
}

/** Wrap `base` so each lookup reads the playback at the playhead, as hover tooltips do. */
export function playbackTooltipDescriptors(
  base: Map<string, TooltipContent>,
  options: Pick<PlaybackTooltipOptions, 'svg' | 'playback' | 'playhead'>,
): Map<string, TooltipContent> {
  return new PlaybackTooltipDescriptors(base, options.svg, (key) => {
    const playback = options.playback();
    return playback ? playbackTooltip(playback, key, options.playhead()) : null;
  });
}
