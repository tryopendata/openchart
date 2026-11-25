/** Writes a playback chart's frames onto the SVG built from its base layout. */
import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';

/** Draws frames onto one rendered SVG. */
export interface ChartFrameWriter {
  /** Write `playback.marksAt(t)` onto the base elements. */
  draw(t: number): void;
  /** Drop element references. Leaves the SVG as last drawn. */
  destroy(): void;
}

/** Geometry attributes each mark type has per frame. */
function geometryOf(mark: Mark): Record<string, number> | null {
  if (mark.type === 'point') return { cx: mark.cx, cy: mark.cy, r: mark.r };
  if (mark.type === 'rect') {
    return { x: mark.x, y: mark.y, width: mark.width, height: mark.height };
  }
  return null;
}

/** Fades by presence on the `opacity` attribute, leaving the authored fill opacity alone. */
function writePresence(element: Element, presence: number): void {
  if (presence >= 1) element.removeAttribute('opacity');
  else element.setAttribute('opacity', String(presence));
}

/**
 * Bind to the `[data-key]` mark elements of `svg` and write each frame's geometry (cx, cy,
 * r for points; x, y, width, height for rects) and `presence` as the `opacity` attribute, by
 * key. Fill opacity stays as the renderer set it. Keys with no element are ignored, and elements without `data-key` are
 * never touched; matching never uses array position or `data-mark-id`.
 */
export function createChartFrameWriter(svg: SVGElement, playback: ChartPlayback): ChartFrameWriter {
  let elementsByKey: Map<string, Element> | null = new Map();
  for (const element of svg.querySelectorAll('[data-key]')) {
    elementsByKey.set(element.getAttribute('data-key') as string, element);
  }

  return {
    draw(t) {
      if (!elementsByKey) return;
      for (const { key, mark, presence } of playback.marksAt(t)) {
        const element = elementsByKey.get(key);
        if (!element) continue;
        const geometry = geometryOf(mark);
        if (geometry) {
          for (const [name, value] of Object.entries(geometry)) {
            element.setAttribute(name, String(value));
          }
        }
        writePresence(element, presence);
      }
    },
    destroy() {
      elementsByKey = null;
    },
  };
}
