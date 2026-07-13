import type { MapProjection } from '@opendata-ai/openchart-core';
import type { GeoIdentityTransform, GeoPermissibleObjects, GeoProjection } from 'd3-geo';
import { geoAlbersUsa, geoEqualEarth, geoIdentity, geoMercator } from 'd3-geo';

export function createProjection(
  type: MapProjection,
  width: number,
  height: number,
  geojson: GeoPermissibleObjects,
): GeoProjection | GeoIdentityTransform {
  if (type === 'identity') {
    return geoIdentity().fitSize([width, height], geojson);
  }

  const projection =
    type === 'albersUsa' ? geoAlbersUsa() : type === 'equalEarth' ? geoEqualEarth() : geoMercator();

  projection.fitSize([width, height], geojson);
  return projection;
}
