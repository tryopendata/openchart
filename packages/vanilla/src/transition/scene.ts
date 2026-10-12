import type { ChartLayout, Mark } from '@opendata-ai/openchart-core';
import type { GeometrySnapshot } from './types';

/** Sample only when requested. No spatial index or DOM measurement per frame. */
export function sampleLayout(layout: ChartLayout, snapshot?: GeometrySnapshot): ChartLayout {
  if (!snapshot?.size) return layout;
  const marks = layout.marks.map((mark): Mark => {
    const geometry = mark.key ? snapshot.get(mark.key) : undefined;
    if (!geometry) return mark;
    if (
      ((mark.type === 'line' && geometry.type === 'line') ||
        (mark.type === 'area' && geometry.type === 'area')) &&
      geometry.points
    ) {
      const positions = new Map(
        (geometry.pointKeys ?? mark.pointKeys ?? []).map((key, index) => [
          key,
          geometry.points![index],
        ]),
      );
      return {
        ...mark,
        ...(mark.type === 'line'
          ? { points: geometry.points }
          : {
              topPoints: geometry.points,
              bottomPoints:
                geometry.type === 'area'
                  ? (geometry.bottomPoints ?? mark.bottomPoints)
                  : mark.bottomPoints,
            }),
        path: geometry.d,
        dataPoints: mark.dataPoints?.map((point, index) => ({
          ...point,
          ...(positions.get(mark.pointKeys?.[index] ?? '') ?? point),
        })),
      };
    }
    if (mark.type === 'arc' && geometry.type === 'arc')
      return { ...mark, ...geometry, center: { x: geometry.cx, y: geometry.cy } };
    if (mark.type === 'rect' && geometry.type === 'rect') return { ...mark, ...geometry };
    if (mark.type === 'point' && geometry.type === 'point')
      return { ...mark, ...geometry, r: geometry.r ?? mark.r };
    return mark;
  });
  return { ...layout, marks };
}
