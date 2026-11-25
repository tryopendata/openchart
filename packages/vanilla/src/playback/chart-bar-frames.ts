/**
 * Writes a playback bar chart's frames onto the bar shapes and value labels. A bar's key
 * sits on its `.oc-mark-rect` group, but its geometry lives on the `<rect>` or corner-rounded
 * `<path>` inside and its value label in the separate overlay group, so each frame writes
 * them by key here.
 */
import type { RectMark } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import { rectPathWithCorners } from '../renderers/marks';
import { applyTextStyle } from '../renderers/svg-dom';
import type { PlaybackFrameWriter } from './playback-mount';

const ALL_CORNERS = { tl: true, tr: true, br: true, bl: true };

/** The drawn parts of one keyed bar. */
interface BarElements {
  shape: Element | null;
  label: SVGElement | null;
}

function writeShape(shape: Element, mark: RectMark): void {
  if (shape.tagName.toLowerCase() === 'path') {
    shape.setAttribute('d', rectPathWithCorners(mark, mark.cornerRadiusSides ?? ALL_CORNERS));
    return;
  }
  shape.setAttribute('x', String(mark.x));
  shape.setAttribute('y', String(mark.y));
  shape.setAttribute('width', String(mark.width));
  shape.setAttribute('height', String(mark.height));
}

/**
 * Writes the frame's value label onto the element the base render drew, hiding it when the
 * frame's label is hidden. A bar whose base label was hidden has no element to write.
 */
function writeLabel(label: SVGElement, mark: RectMark, presence: number): void {
  const frame = mark.label;
  if (!frame?.visible || presence <= 0) {
    label.setAttribute('visibility', 'hidden');
    return;
  }
  label.removeAttribute('visibility');
  label.setAttribute('x', String(frame.x));
  label.setAttribute('y', String(frame.y));
  if (label.textContent !== frame.text) label.textContent = frame.text;
  applyTextStyle(label, frame.style);
  if (presence >= 1) label.removeAttribute('opacity');
  else label.setAttribute('opacity', String(presence));
}

/**
 * Bind to the bars of `svg` (`.oc-mark-rect[data-key]`) and their value labels
 * (`[data-label-key]`) and write each frame's bar geometry and label by key. Returns null
 * when the SVG has no keyed bars.
 */
export function createChartBarWriter(
  svg: SVGElement,
  playback: ChartPlayback,
): PlaybackFrameWriter | null {
  let bars: Map<string, BarElements> | null = new Map();
  for (const group of svg.querySelectorAll('.oc-mark-rect[data-key]')) {
    const key = group.getAttribute('data-key') as string;
    const label = svg.querySelector<SVGElement>(`[data-label-key="${CSS.escape(key)}"]`);
    bars.set(key, { shape: group.querySelector('rect, path'), label });
  }
  if (!bars.size) return null;

  return {
    draw(t) {
      if (!bars) return;
      for (const { key, mark, presence } of playback.marksAt(t)) {
        const bar = bars.get(key);
        if (!bar || mark.type !== 'rect') continue;
        if (bar.shape) writeShape(bar.shape, mark);
        if (bar.label) writeLabel(bar.label, mark, presence);
      }
    },
    destroy() {
      bars = null;
    },
  };
}
