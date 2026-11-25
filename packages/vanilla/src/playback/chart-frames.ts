/** Writes a playback chart's frames onto the SVG built from its base layout. */
import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';

/** Draws frames onto one rendered SVG. */
export interface ChartFrameWriter {
  /** Write `playback.marksAt(t)` and `playback.overlaysAt(t)` onto the base elements. */
  draw(t: number): void;
  /** Drop element references. Leaves the SVG as last drawn. */
  destroy(): void;
}

/** Geometry attributes each mark type has per frame. */
function geometryOf(mark: Mark): Record<string, number> | null {
  if (mark.type === 'point') return { cx: mark.cx, cy: mark.cy, r: mark.r };
  if (mark.type === 'textMark') return { x: mark.x, y: mark.y };
  return null;
}

/** Fades by presence on the `opacity` attribute, leaving the authored fill opacity alone. */
function writePresence(element: Element, presence: number): void {
  if (presence >= 1) element.removeAttribute('opacity');
  else element.setAttribute('opacity', String(presence));
}

/**
 * Writes a text mark's anchor and text when they differ from the element's. The period
 * label's text changes only at period boundaries, so most frames write nothing here.
 */
function writeText(element: Element, mark: Mark): void {
  if (mark.type !== 'textMark') return;
  if (element.getAttribute('text-anchor') !== mark.textAnchor) {
    element.setAttribute('text-anchor', mark.textAnchor);
  }
  if (element.textContent !== mark.text) element.textContent = mark.text;
}

/**
 * Bind to the `[data-key]` elements of `svg` and write each frame's marks and overlays by
 * key: geometry (cx, cy, r for points; x, y for text; bar geometry is `chart-bar-frames.ts`), text
 * content and anchor for text marks when they change, and `presence` as the `opacity`
 * attribute. Fill opacity stays as the renderer set it. Keys with no element are ignored, and elements
 * without `data-key` are never touched; matching never uses array position or
 * `data-mark-id`.
 */
export function createChartFrameWriter(svg: SVGElement, playback: ChartPlayback): ChartFrameWriter {
  let elementsByKey: Map<string, Element> | null = new Map();
  for (const element of svg.querySelectorAll('[data-key]')) {
    elementsByKey.set(element.getAttribute('data-key') as string, element);
  }

  return {
    draw(t) {
      if (!elementsByKey) return;
      const frame = [...playback.marksAt(t), ...playback.overlaysAt(t)];
      for (const { key, mark, presence } of frame) {
        const element = elementsByKey.get(key);
        if (!element) continue;
        const geometry = geometryOf(mark);
        if (geometry) {
          for (const [name, value] of Object.entries(geometry)) {
            element.setAttribute(name, String(value));
          }
        }
        writeText(element, mark);
        writePresence(element, presence);
      }
    },
    destroy() {
      elementsByKey = null;
    },
  };
}
