import type { MapProjection } from '@opendata-ai/openchart-core';
import type { GeoIdentityTransform, GeoPermissibleObjects, GeoProjection } from 'd3-geo';
import { geoAlbersUsa, geoBounds, geoEqualEarth, geoIdentity, geoMercator } from 'd3-geo';

// Mercator inflates polar regions toward infinity. Fitting against features
// entirely below this latitude (Antarctica) wastes most of the map area on
// empty ocean. Exclude them from the fit; they still render if in view.
const MERCATOR_FIT_MIN_LAT = -60;

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

  const fitGeometry = type === 'mercator' ? excludePolarFeatures(geojson) : geojson;
  projection.fitSize([width, height], fitGeometry);
  return projection;
}

function excludePolarFeatures(geojson: GeoPermissibleObjects): GeoPermissibleObjects {
  // GeoPermissibleObjects doesn't include FeatureCollection in its type union,
  // but topojson.feature() returns one at runtime. Work with the runtime shape.
  const obj = geojson as unknown as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) return geojson;

  const features = obj.features as Array<Record<string, unknown>>;
  const filtered = features.filter((f) => {
    try {
      const b = geoBounds(f as unknown as GeoPermissibleObjects);
      return b[1][1] > MERCATOR_FIT_MIN_LAT;
    } catch {
      return true;
    }
  });
  if (filtered.length === 0) return geojson;
  return { type: 'FeatureCollection', features: filtered } as unknown as GeoPermissibleObjects;
}
