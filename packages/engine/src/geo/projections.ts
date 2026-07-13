import type { MapProjection } from '@opendata-ai/openchart-core';
import type { GeoPermissibleObjects } from 'd3-geo';
import { geoAlbersUsa, geoEqualEarth, geoMercator } from 'd3-geo';

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
