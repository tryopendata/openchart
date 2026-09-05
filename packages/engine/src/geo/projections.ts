import type { GeoMapProjection } from '@opendata-ai/openchart-core';
import type { GeoIdentityTransform, GeoPermissibleObjects, GeoProjection } from 'd3-geo';
import { geoAlbersUsa, geoBounds, geoEqualEarth, geoIdentity, geoMercator } from 'd3-geo';

// Mercator inflates polar regions toward infinity. Fitting against features
// entirely below this latitude (Antarctica) wastes most of the map area on
// empty ocean. Exclude them from the fit; they still render if in view.
const MERCATOR_FIT_MIN_LAT = -60;

export function createProjection(
  type: GeoMapProjection,
  width: number,
  height: number,
  geojson: GeoPermissibleObjects,
  inset = 0,
): GeoProjection | GeoIdentityTransform {
  if (type === 'identity') {
    if (inset > 0) {
      return geoIdentity().fitExtent(
        [
          [inset, inset],
          [width - inset, height - inset],
        ],
        geojson,
      );
    }
    return geoIdentity().fitSize([width, height], geojson);
  }

  const projection =
    type === 'albersUsa' ? geoAlbersUsa() : type === 'equalEarth' ? geoEqualEarth() : geoMercator();

  const fitGeometry = type === 'mercator' ? excludePolarFeatures(geojson) : geojson;
  if (inset > 0) {
    projection.fitExtent(
      [
        [inset, inset],
        [width - inset, height - inset],
      ],
      fitGeometry,
    );
  } else {
    projection.fitSize([width, height], fitGeometry);
  }
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

/**
 * Infer a projection from the topology when the spec does not name one.
 *
 * - Pre-projected coordinates (a bbox outside the lon/lat ranges, as shipped by
 *   us-atlas) can only be drawn 1:1, so they get `identity`.
 * - A near-global longitude span (world-atlas) gets the equal-area `equalEarth`.
 * - Anything else gets `albersUsa`, the historical default.
 */
export function resolveDefaultProjection(topology: unknown): GeoMapProjection {
  const bbox = topologyBBox(topology);
  if (!bbox) return 'albersUsa';
  const [minX, minY, maxX, maxY] = bbox;
  const preProjected = minX < -180.5 || maxX > 180.5 || minY < -90.5 || maxY > 90.5;
  if (preProjected) return 'identity';
  if (maxX - minX > 200) return 'equalEarth';
  return 'albersUsa';
}

/**
 * Bounding box of a TopoJSON topology as [minX, minY, maxX, maxY].
 *
 * Prefers the topology's own `bbox`. Without one, walks the arcs: a quantized
 * topology stores integer deltas that need a running sum plus the transform,
 * an unquantized one stores absolute coordinates.
 */
function topologyBBox(topology: unknown): [number, number, number, number] | null {
  if (!topology || typeof topology !== 'object') return null;
  const topo = topology as {
    bbox?: number[];
    transform?: { scale: [number, number]; translate: [number, number] };
    arcs?: number[][][];
  };
  if (Array.isArray(topo.bbox) && topo.bbox.length >= 4) {
    const box = topo.bbox.slice(0, 4);
    if (box.every((n) => Number.isFinite(n))) {
      return [box[0], box[1], box[2], box[3]];
    }
  }
  if (!Array.isArray(topo.arcs) || topo.arcs.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const quantized = !!topo.transform;
  for (const arc of topo.arcs) {
    let x = 0;
    let y = 0;
    for (const point of arc) {
      if (!Array.isArray(point) || point.length < 2) continue;
      if (quantized) {
        x += point[0];
        y += point[1];
      } else {
        x = point[0];
        y = point[1];
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  if (topo.transform) {
    const { scale, translate } = topo.transform;
    return [
      minX * scale[0] + translate[0],
      minY * scale[1] + translate[1],
      maxX * scale[0] + translate[0],
      maxY * scale[1] + translate[1],
    ];
  }
  return [minX, minY, maxX, maxY];
}
