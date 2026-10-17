import type { Point, ResolvedAnnotation } from '@opendata-ai/openchart-core';
import { refreshConnector } from './geometry';
import { markerClearance } from './resolve-text';

/** Sample label and attachment independently. Leader visibility is chosen by the final layout. */
export function interpolateAnnotationGeometry(
  before: ResolvedAnnotation,
  after: ResolvedAnnotation,
  t: number,
): ResolvedAnnotation {
  if (t >= 1) return structuredClone(after);
  const result = structuredClone(after);
  const point = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  if (before.label && result.label) {
    const pos = point(before.label, result.label);
    const dx = pos.x - result.label.x;
    const dy = pos.y - result.label.y;
    result.label.x = pos.x;
    result.label.y = pos.y;
    if (result.label.bounds) {
      result.label.bounds.x += dx;
      result.label.bounds.y += dy;
    }
    if (result.bounds) {
      result.bounds.x += dx;
      result.bounds.y += dy;
    }
    if (result.subtitle) {
      result.subtitle.x += dx;
      result.subtitle.y += dy;
    }
  }
  if (before.dot && result.dot) Object.assign(result.dot, point(before.dot, result.dot));
  if (before.line && result.line) {
    result.line.start = point(before.line.start, result.line.start);
    result.line.end = point(before.line.end, result.line.end);
  }
  if (before.rect && result.rect) {
    const rect = result.rect;
    Object.assign(rect, point(before.rect, rect));
    rect.width = before.rect.width + (rect.width - before.rect.width) * t;
    rect.height = before.rect.height + (rect.height - before.rect.height) * t;
  }
  const connector = result.label?.connector;
  if (connector?.endpoint && result.bounds) {
    const start = before.label?.connector?.endpoint ?? before.dot ?? connector.endpoint;
    connector.endpoint = point(start, connector.endpoint);
    result.label!.connector = refreshConnector(
      connector,
      result.bounds,
      markerClearance(result.dot),
      true,
    );
  }
  return result;
}
