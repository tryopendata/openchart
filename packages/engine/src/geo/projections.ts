import type { MapProjection } from '@opendata-ai/openchart-core';
import type { GeoPermissibleObjects } from 'd3-geo';
import { geoAlbersUsa, geoEqualEarth, geoMercator, geoPath } from 'd3-geo';

export function createProjection(
  type: MapProjection,
  width: number,
  height: number,
  geojson: GeoPermissibleObjects,
) {
  if (type === 'identity') return null;

  const projection =
    type === 'albersUsa' ? geoAlbersUsa() : type === 'equalEarth' ? geoEqualEarth() : geoMercator();

  projection.fitSize([width, height], geojson);
  return projection;
}

export function createPathGenerator(projection: ReturnType<typeof geoAlbersUsa> | null) {
  return geoPath(projection);
}

export function computeIdentityTransform(
  pathGen: ReturnType<typeof geoPath>,
  geojson: GeoPermissibleObjects,
  width: number,
  height: number,
): { scale: number; translateX: number; translateY: number } {
  const bounds = pathGen.bounds(geojson);
  const [[x0, y0], [x1, y1]] = bounds;
  const bw = x1 - x0;
  const bh = y1 - y0;

  if (bw <= 0 || bh <= 0) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }

  const scale = Math.min(width / bw, height / bh);
  const translateX = (width - bw * scale) / 2 - x0 * scale;
  const translateY = (height - bh * scale) / 2 - y0 * scale;

  return { scale, translateX, translateY };
}
