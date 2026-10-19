import type { AreaMark, LineMark } from '@opendata-ai/openchart-core';

/** The endpoint's source observation and anchor are resolved together. */
export function endpointObservation(
  mark: LineMark | AreaMark,
  side: 'leading' | 'trailing',
  anchor: 'boundary' | 'band' = 'boundary',
): { x: number; y: number; datum: Record<string, unknown>; band: boolean } | null {
  const points = mark.dataPoints;
  if (points?.length) {
    let index = side === 'leading' ? 0 : points.length - 1;
    const delta = side === 'leading' ? 1 : -1;
    while (index >= 0 && index < points.length) {
      const point = points[index];
      if (!('observed' in point) || point.observed !== false) {
        const band = anchor === 'band' && mark.type === 'area' && mark.stacked === true;
        const bottom = mark.type === 'area' ? mark.bottomPoints[index]?.y : undefined;
        return {
          x: point.x,
          y: band && bottom != null ? (point.y + bottom) / 2 : point.y,
          datum: point.datum,
          band,
        };
      }
      index += delta;
    }
    return null;
  }
  const geometry = mark.type === 'line' ? mark.points : mark.topPoints;
  const index = side === 'leading' ? 0 : geometry.length - 1;
  const point = geometry[index];
  if (!point) return null;
  return { ...point, datum: mark.data[index] ?? {}, band: false };
}
