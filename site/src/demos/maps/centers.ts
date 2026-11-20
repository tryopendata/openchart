/**
 * Where to put a symbol for a state or country: the centroid of its largest
 * polygon, computed from the same geography the map draws. The datasets name
 * places but carry no coordinates, and this keeps every symbol on its shape.
 */
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { type Point, ringArea, ringCentroid } from "./plane-geometry";

/** A longitude and latitude, rounded to two decimals. */
export type LonLat = { lon: number; lat: number };

/** The outer rings of a GeoJSON polygon or multipolygon geometry. */
function outerRings(geometry: GeoJSON.Geometry | null): Point[][] {
  if (geometry?.type === "Polygon") return geometry.coordinates.slice(0, 1);
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.map(([outer = []]) => outer);
  return [];
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The center of the feature in `object` whose `properties.name` is `name`.
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
  const rings = outerRings(match.geometry);
  const largest = rings.reduce<Point[]>(
    (best, ring) => (ringArea(ring) > ringArea(best) ? ring : best),
    [],
  );
  const [lon = 0, lat = 0] = ringCentroid(largest);
  return { lon: round(lon), lat: round(lat) };
}
