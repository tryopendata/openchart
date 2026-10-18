import type {
  AreaMark,
  EndpointLabelsLayout,
  MeasureTextFn,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';

/** Name-only rectangle fit against compiled contiguous band bounds. */
export function fitInteriorLabel(
  mark: AreaMark,
  style: TextStyle,
  color: string,
  measureText?: MeasureTextFn,
): NonNullable<EndpointLabelsLayout['interior']>[number] | null {
  if (!mark.stacked || !mark.seriesKey || !mark.dataPoints?.length) return null;
  // Natural/cardinal curves can overshoot their observation envelope. A box
  // proved only against samples is not a proof of containment for those paths.
  if (
    mark.interpolate &&
    !['linear', 'monotone', 'step', 'step-before', 'step-after'].includes(mark.interpolate)
  )
    return null;
  const size = style.fontSize ?? 11;
  const measured = measureText?.(mark.seriesKey, size, style.fontWeight);
  const width = measured?.width ?? estimateTextWidth(mark.seriesKey, size, style.fontWeight);
  const height = Math.max(measured?.height ?? size, size * (style.lineHeight ?? 1.25));
  const padding = 4;
  let best: { left: number; right: number; top: number; bottom: number } | null = null;
  const points = mark.dataPoints;
  for (let start = 0; start < points.length; start++) {
    const first = points[start];
    if (first.observed === false) continue;
    // Once the entire remaining x span is narrower, it cannot improve the
    // accepted candidate. This makes broad, flat bands a linear scan.
    if (best && points[points.length - 1].x - first.x < best.right - best.left) continue;
    let top = Number.NEGATIVE_INFINITY;
    let bottom = Number.POSITIVE_INFINITY;
    for (let end = start; end < points.length; end++) {
      const point = points[end];
      if (point.observed === false || point.segment !== first.segment) break;
      const lower = point.yBottom ?? mark.bottomPoints[end]?.y;
      if (lower == null) break;
      top = Math.max(top, Math.min(point.y, lower));
      bottom = Math.min(bottom, Math.max(point.y, lower));
      if (bottom - top < height + padding * 2) break;
      const left = first.x;
      const right = point.x;
      if (right - left < width + padding * 2) continue;
      if (
        !best ||
        right - left > best.right - best.left ||
        (right - left === best.right - best.left && right > best.right)
      ) {
        best = { left, right, top, bottom };
      }
    }
  }
  if (!best) return null;
  return {
    seriesKey: mark.seriesKey,
    text: mark.seriesKey,
    x: (best.left + best.right - width) / 2,
    y: (best.top + best.bottom - height) / 2,
    color,
    width,
    height,
  };
}
