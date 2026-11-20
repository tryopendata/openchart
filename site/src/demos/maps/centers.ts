/**
 * Where to put a symbol for a state or country: the centroid of its largest
 * polygon, computed from the same geography the map draws. The datasets name
 * places but carry no coordinates, and this keeps every symbol on its shape.
 * Areas and centroids are measured on the sphere (d3-geo), so shapes that
 * cross the 180th meridian, such as Russia, get a center inside them.
 */
import { geoArea, geoBounds, geoCentroid, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

/** A longitude and latitude, rounded to two decimals. */
export type LonLat = { lon: number; lat: number };

/** Grid steps per side when searching a concave polygon for a point inside it. */
const SEARCH_STEPS = 24;

/** The polygons of a GeoJSON polygon or multipolygon geometry. */
function polygonsOf(geometry: GeoJSON.Geometry | null): GeoJSON.Polygon[] {
  if (geometry?.type === "Polygon") return [geometry];
  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }));
  }
  return [];
}

/**
 * A point inside `polygon`: its centroid when that lies inside, otherwise the
 * point of a grid over its bounds that lies inside and nearest the centroid.
 * A concave shape, such as a crescent, can have its centroid outside it.
 */
function pointInside(polygon: GeoJSON.Polygon): [number, number] {
  const centroid = geoCentroid(polygon);
  if (geoContains(polygon, centroid)) return centroid;
  const [[west, south], [east, north]] = geoBounds(polygon);
  // Bounds that cross the 180th meridian have east < west; unwrap them for the grid.
  const span = east >= west ? east - west : east + 360 - west;
  let best: [number, number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= SEARCH_STEPS; i++) {
    for (let j = 0; j <= SEARCH_STEPS; j++) {
      const lon = ((west + (span * i) / SEARCH_STEPS + 540) % 360) - 180;
      const candidate: [number, number] = [lon, south + ((north - south) * j) / SEARCH_STEPS];
      if (!geoContains(polygon, candidate)) continue;
      const distance = Math.hypot(candidate[0] - centroid[0], candidate[1] - centroid[1]);
      if (distance < bestDistance) [best, bestDistance] = [candidate, distance];
    }
  }
  return best ?? centroid;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The center of the feature in `object` whose `properties.name` is `name`:
 * a point inside its largest polygon, as near that polygon's centroid as the shape allows.
 *
 * @throws {Error} When the object or a feature with that name is missing.
 */
export function centerOf(topology: Topology, object: string, name: string): LonLat {
  const geometries = topology.objects[object];
  if (!geometries) throw new Error(`The topology has no object "${object}".`);
  const collection = feature(topology, geometries);
  const features = "features" in collection ? collection.features : [collection];
  const match = features.find((candidate) => candidate.properties?.name === name);
  if (!match) throw new Error(`No feature in "${object}" is named "${name}".`);
  const [largest] = polygonsOf(match.geometry).sort((a, b) => geoArea(b) - geoArea(a));
  if (!largest) throw new Error(`The feature "${name}" in "${object}" has no polygon.`);
  const [lon, lat] = pointInside(largest);
  return { lon: round(lon), lat: round(lat) };
}
