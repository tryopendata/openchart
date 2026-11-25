/**
 * Hover tooltips for a playback chart's keyed marks. Content comes from `playbackTooltip`
 * at the current playhead, so an open tooltip follows the frame as playback moves.
 */
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

function keyedMark(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('[data-key]') : null;
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
    const element = keyedMark(event.target);
    const { clientX, clientY } = event as MouseEvent;
    if (element) hoverAt(element, clientX, clientY);
  }

  function onPointerOut(event: Event) {
    if (!hovered) return;
    const next = keyedMark((event as MouseEvent).relatedTarget);
    if (next === hovered.element) return;
    hovered = null;
    tooltips.hide();
    emphasis?.clear();
  }

  function onTouchStart(event: Event) {
    const touch = (event as TouchEvent).touches[0];
    const element = keyedMark(event.target);
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
