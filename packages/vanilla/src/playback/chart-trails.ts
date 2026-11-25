/**
 * Draws a playback chart's trails live: for each key `playback.trails` names, a thin line
 * through its observed period positions up to the playhead, ending at the mark, with a small
 * dot at each observed position. Trails sit under the marks inside the plot clip. Geometry,
 * color and style come from the engine's trail marks module, which static output and exports
 * draw from too; this writer only updates attributes in place so each frame stays cheap.
 */
import {
  type ChartPlayback,
  TRAIL_STYLE,
  type TrailPath,
  trailColorsByKey,
  trailLinePoints,
} from '@opendata-ai/openchart-engine';
import { SVG_NS } from '../renderers/svg-dom';

/** Draws trails onto one rendered SVG. */
export interface ChartTrailWriter {
  /** Write `playback.trailsAt(t)` onto the trail elements. */
  draw(t: number): void;
  /** Remove the trail layer. */
  destroy(): void;
}

const TRAILS_CLASS = 'oc-playback-trails';
const TRAIL_FALLBACK_COLOR = 'currentColor';

interface TrailElements {
  group: SVGGElement;
  line: SVGPolylineElement;
  dots: SVGGElement;
}

function createTrail(
  svg: SVGElement,
  layer: SVGGElement,
  key: string,
  color: string,
): TrailElements {
  const doc = svg.ownerDocument;
  const group = doc.createElementNS(SVG_NS, 'g') as SVGGElement;
  group.setAttribute('class', 'oc-playback-trail');
  group.setAttribute('data-trail-key', key);
  group.setAttribute('aria-hidden', 'true');
  group.setAttribute('pointer-events', 'none');
  const line = doc.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', String(TRAIL_STYLE.strokeWidth));
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', String(TRAIL_STYLE.opacity));
  const dots = doc.createElementNS(SVG_NS, 'g') as SVGGElement;
  dots.setAttribute('fill', color);
  dots.setAttribute('fill-opacity', String(TRAIL_STYLE.opacity));
  group.append(line, dots);
  layer.append(group);
  return { group, line, dots };
}

/** Write one trail: the line through every observed point to the head, one dot per point. */
function writeTrail(elements: TrailElements, trail: TrailPath | undefined): void {
  const points = trail ? trailLinePoints(trail) : [];
  elements.line.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
  const observed = trail?.points ?? [];
  const dots = elements.dots;
  while (dots.childElementCount > observed.length) dots.lastElementChild?.remove();
  while (dots.childElementCount < observed.length) {
    const dot = dots.ownerDocument.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', String(TRAIL_STYLE.dotRadius));
    dots.append(dot);
  }
  observed.forEach((point, index) => {
    const dot = dots.children[index];
    dot.setAttribute('cx', String(point.x));
    dot.setAttribute('cy', String(point.y));
  });
}

/**
 * Bind a trail layer to `svg`, or return null when the playback draws no trails or the SVG
 * has no marks group. One `[data-trail-key]` group per trail key exists from the start, so
 * series hiding can reach it before the key's first point.
 */
export function createChartTrailWriter(
  svg: SVGElement,
  playback: ChartPlayback,
): ChartTrailWriter | null {
  const finalTrails = playback.trailsAt(Math.max(0, playback.periods.length - 1));
  const marksGroup = svg.querySelector('[data-oc-marks-group]');
  if (finalTrails.length === 0 || !marksGroup) return null;
  const layer = svg.ownerDocument.createElementNS(SVG_NS, 'g') as SVGGElement;
  layer.setAttribute('class', TRAILS_CLASS);
  marksGroup.prepend(layer);
  const trails = new Map<string, TrailElements>();
  const colors = trailColorsByKey(playback.base);
  for (const { key } of finalTrails) {
    trails.set(key, createTrail(svg, layer, key, colors.get(key) ?? TRAIL_FALLBACK_COLOR));
  }

  return {
    draw(t) {
      const drawn = new Map(playback.trailsAt(t).map((trail) => [trail.key, trail]));
      for (const [key, elements] of trails) writeTrail(elements, drawn.get(key));
    },
    destroy() {
      layer.remove();
      trails.clear();
    },
  };
}
