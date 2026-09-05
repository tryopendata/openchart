import type { TooltipContent } from '@opendata-ai/openchart-core';
import type { TooltipManager } from '../tooltip';
import type { HoverEmphasis } from './hover-emphasis';

/**
 * Wire tooltip events on mark elements inside an SVG.
 * Returns a cleanup function to remove all listeners.
 */
export function wireTooltipEvents(
  svg: SVGElement,
  tooltipDescriptors: Map<string, TooltipContent>,
  tooltipManager: TooltipManager,
  emphasis?: HoverEmphasis,
): () => void {
  const markElements = svg.querySelectorAll('[data-mark-id]');
  const cleanups: Array<() => void> = [];

  for (const el of markElements) {
    const markId = el.getAttribute('data-mark-id');
    if (!markId) continue;

    const content = tooltipDescriptors.get(markId);
    if (!content) continue;

    const handleMouseEnter = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const svgRect = svg.getBoundingClientRect();
      const x = mouseEvent.clientX - svgRect.left;
      const y = mouseEvent.clientY - svgRect.top;
      tooltipManager.show(content, x, y);
      emphasis?.setMark(el);
    };

    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const svgRect = svg.getBoundingClientRect();
      const x = mouseEvent.clientX - svgRect.left;
      const y = mouseEvent.clientY - svgRect.top;
      tooltipManager.show(content, x, y);
    };

    const handleMouseLeave = () => {
      tooltipManager.hide();
      emphasis?.clear();
    };

    const handleTouchStart = (e: Event) => {
      const touchEvent = e as TouchEvent;
      if (touchEvent.touches.length > 0) {
        const touch = touchEvent.touches[0];
        const svgRect = svg.getBoundingClientRect();
        const x = touch.clientX - svgRect.left;
        const y = touch.clientY - svgRect.top;
        tooltipManager.show(content, x, y);
        emphasis?.setMark(el);
      }
    };

    // A tap raises the mark the same way hover does, and nothing else ever
    // drops that emphasis on touch -- there is no mouseleave. The tooltip
    // stays up (tap-to-read); only the dimming of everything else lifts.
    const handleTouchEnd = () => {
      emphasis?.clear();
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('touchstart', handleTouchStart);
    el.addEventListener('touchend', handleTouchEnd);

    cleanups.push(() => {
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
