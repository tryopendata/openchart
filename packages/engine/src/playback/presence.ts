/** Presence (a key's fade in or out) as the opacity a static mark carries. */
import type { Mark } from '@opendata-ai/openchart-core';

/**
 * `mark` faded by `presence` (0..1) for static output, matching the live frame writer, which
 * fades every keyed element: points, rects and areas multiply their fill opacity; lines, rules,
 * ticks and text marks their opacity. Full presence returns the mark itself.
 */
export function fadeMark(mark: Mark, presence: number): Mark {
  if (presence >= 1) return mark;
  switch (mark.type) {
    case 'point':
    case 'rect':
    case 'area':
      return { ...mark, fillOpacity: (mark.fillOpacity ?? 1) * presence };
    case 'line':
    case 'rule':
    case 'tick':
    case 'textMark':
      return { ...mark, opacity: (mark.opacity ?? 1) * presence };
    default:
      return mark;
  }
}
