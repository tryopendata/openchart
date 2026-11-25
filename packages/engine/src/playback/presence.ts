/** Presence (a key's fade in or out) as the opacity a static mark carries. */
import type { Mark } from '@opendata-ai/openchart-core';

/**
 * `mark` faded by `presence` (0..1) for static output, matching the live frame writer, which
 * fades every keyed element: points and rects multiply their fill opacity, lines, rules and
 * ticks their opacity, and areas their fill opacity. Text marks have no opacity slot to
 * carry it and return unchanged. Full presence returns the mark itself.
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
      return { ...mark, opacity: (mark.opacity ?? 1) * presence };
    default:
      return mark;
  }
}
