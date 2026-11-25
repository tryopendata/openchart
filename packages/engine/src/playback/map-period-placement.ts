/**
 * Where a map's period label goes. An authored position is honored as is; `auto` takes the
 * corner of the map area the label covers least geography in, preferring the lower left.
 * US maps put Alaska and Hawaii in that corner and tile maps put AK and HI there, so a fixed
 * corner would print the label over states.
 */
import {
  estimateTextWidth,
  type PlaybackPeriodPosition,
  type Rect,
} from '@opendata-ai/openchart-core';
import { type PeriodLabelPlacement, periodLabelPlacement } from './overlays';

/** Corners `auto` tries, in order of preference: the first of equal overlap wins. */
const AUTO_CORNERS = ['bottom-left', 'top-left', 'bottom-right', 'top-right'] as const;
type Corner = (typeof AUTO_CORNERS)[number];

/** A corner placement built from the two corners `periodLabelPlacement` knows. */
function cornerPlacement(corner: Corner, area: Rect): PeriodLabelPlacement {
  const lowerLeft = periodLabelPlacement('bottom-left', area, 'map');
  const upperRight = periodLabelPlacement('top-right', area, 'map');
  const left = corner.endsWith('left');
  const top = corner.startsWith('top');
  return {
    ...lowerLeft,
    x: left ? lowerLeft.x : upperRight.x,
    y: top ? upperRight.y : lowerLeft.y,
    textAnchor: left ? 'start' : 'end',
    dominantBaseline: top ? 'hanging' : 'text-after-edge',
  };
}

/** The label's box at a placement, for the widest period text. */
function labelBox(placement: PeriodLabelPlacement, width: number): Rect {
  const height = placement.fontSize;
  return {
    x: placement.textAnchor === 'start' ? placement.x : placement.x - width,
    y: placement.dominantBaseline === 'hanging' ? placement.y : placement.y - height,
    width,
    height,
  };
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Place the period label in `area`. `obstacles` are the drawn geography in the same
 * coordinates (feature or tile bounds); `texts` are every period's label, so the chosen
 * corner fits the widest one and never changes mid-run.
 */
export function mapPeriodPlacement(
  position: PlaybackPeriodPosition,
  area: Rect,
  texts: string[],
  obstacles: Rect[],
  fontWeight: number,
): PeriodLabelPlacement {
  if (position !== 'auto') return periodLabelPlacement(position, area, 'map');
  let best = cornerPlacement(AUTO_CORNERS[0], area);
  let bestOverlap = Number.POSITIVE_INFINITY;
  for (const corner of AUTO_CORNERS) {
    const placement = cornerPlacement(corner, area);
    const width = Math.max(
      0,
      ...texts.map((text) => estimateTextWidth(text, placement.fontSize, fontWeight)),
    );
    const box = labelBox(placement, width);
    const overlap = obstacles.reduce((sum, obstacle) => sum + overlapArea(box, obstacle), 0);
    if (overlap < bestOverlap) {
      best = placement;
      bestOverlap = overlap;
    }
  }
  return best;
}
