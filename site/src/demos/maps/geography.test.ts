// The reduced atlases the map demos draw: they must keep every shape the maps
// join data to, keep each country close to its true area, never collapse a ring
// into a line (which a map projection reads as the whole globe), and place
// symbols inside their shapes.
import { geoArea, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import usAtlas from "us-atlas/states-10m.json";
import { describe, expect, it } from "vitest";
import worldAtlas from "world-atlas/countries-110m.json";
import { centerOf } from "./centers";
import { usStates, WORLD_COUNTRIES, worldCountries, worldLand } from "./geography";
import { basicSymbolMap, worldSymbolMap } from "./symbol-map";

type Ring = number[][];

function rings(topology: Topology, object: string): Ring[] {
  const geometries = topology.objects[object];
  if (!geometries) throw new Error(`No object "${object}" in the topology.`);
  const collection = feature(topology, geometries);
  const features = "features" in collection ? collection.features : [collection];
  return features.flatMap(({ geometry }) => {
    if (geometry?.type === "Polygon") return geometry.coordinates;
    if (geometry?.type === "MultiPolygon") return geometry.coordinates.flat();
    return [];
  });
}

const distinctPoints = (ring: Ring) => new Set(ring.map(([x, y]) => `${x},${y}`)).size;

function geometriesOf(topology: Topology, object: string) {
  const collection = topology.objects[object];
  return collection && "geometries" in collection ? collection.geometries : [];
}

function featuresOf(topology: Topology, object: string) {
  const geometries = topology.objects[object];
  if (!geometries) throw new Error(`No object "${object}" in the topology.`);
  const collection = feature(topology, geometries);
  return "features" in collection ? collection.features : [collection];
}

const nameOf = (place: { properties: unknown }) =>
  String((place.properties as { name?: string } | null)?.name);

/** Square degrees on the sphere, the unit WORLD_COUNTRIES.minArea is in. */
const squareDegrees = (shape: GeoJSON.Polygon | GeoJSON.Feature) =>
  geoArea(shape) * (180 / Math.PI) ** 2;

/** A country's original area, leaving out the islands the reduction drops on purpose. */
function areaWithoutDroppedIslands(country: GeoJSON.Feature): number {
  const { geometry } = country;
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  const areas = polygons.map((coordinates) => squareDegrees({ type: "Polygon", coordinates }));
  const largest = Math.max(...areas);
  return areas
    .filter((area) => area >= WORLD_COUNTRIES.minArea || area === largest)
    .reduce((total, area) => total + area, 0);
}

/** The symbol rows of a symbol map demo, with the name of the shape each belongs to. */
function symbolsOf(demo: typeof basicSymbolMap, nameField: string) {
  const { points } = demo.spec as { points: { data: Record<string, unknown>[] } };
  return points.data.map((row) => ({
    name: String(row[nameField]),
    at: [Number(row.lon), Number(row.lat)] as [number, number],
  }));
}

/** world-atlas spells out the United States; the population dataset does not. */
const ATLAS_NAME: Record<string, string> = { "United States": "United States of America" };

const ids = (topology: Topology, object: string) =>
  geometriesOf(topology, object).map((geometry) => String(geometry.id));

const names = (topology: Topology, object: string) =>
  geometriesOf(topology, object).map((geometry) =>
    String((geometry.properties as { name?: string } | undefined)?.name),
  );

describe("the reduced map geography", () => {
  it("keeps the 50 states and DC and leaves out the territories", () => {
    const atlasIds = usAtlas.objects.states.geometries.map((geometry) => geometry.id);
    const expected = atlasIds.filter((id) => Number(id) < 60).sort();
    expect(ids(usStates, "states").sort()).toEqual(expected);
    expect(expected).toHaveLength(51);
  });

  it("keeps every country but Antarctica", () => {
    const countries = names(worldCountries, "countries");
    expect(countries).toContain("Switzerland");
    expect(countries).not.toContain("Antarctica");
  });

  it.each([
    ["US states", usStates, "states"],
    ["world countries", worldCountries, "countries"],
    ["world land", worldLand, "land"],
  ] as const)("leaves every ring of the %s an area", (_name, topology, object) => {
    const collapsed = rings(topology, object).filter((ring) => distinctPoints(ring) < 3);
    expect(collapsed).toEqual([]);
  });

  it("keeps every country at 80% or more of its area, apart from dropped islands", () => {
    const original = featuresOf(worldAtlas as unknown as Topology, "countries");
    const reduced = new Map(featuresOf(worldCountries, "countries").map((c) => [nameOf(c), c]));
    const shrunk = original
      .filter((country) => reduced.has(nameOf(country)))
      .map((country) => {
        const kept = reduced.get(nameOf(country)) as GeoJSON.Feature;
        return [nameOf(country), squareDegrees(kept) / areaWithoutDroppedIslands(country)] as const;
      })
      .filter(([, share]) => share < 0.8);
    expect(shrunk).toEqual([]);
  });

  it.each([
    ["state", basicSymbolMap, "state", usStates, "states"],
    ["country", worldSymbolMap, "country", worldCountries, "countries"],
  ] as const)("places every %s symbol inside its shape", (_kind, demo, field, topology, object) => {
    const shapes = new Map(featuresOf(topology, object).map((shape) => [nameOf(shape), shape]));
    const outside = symbolsOf(demo, field)
      .filter(({ name, at }) => {
        const shape = shapes.get(ATLAS_NAME[name] ?? name);
        return !shape || !geoContains(shape, at);
      })
      .map(({ name }) => name);
    expect(outside).toEqual([]);
  });

  it("places Russia's symbol in Russia, across the 180th meridian from Alaska", () => {
    const russia = featuresOf(worldCountries, "countries").find((c) => nameOf(c) === "Russia");
    const { lon, lat } = centerOf(worldCountries, "countries", "Russia");
    expect(russia && geoContains(russia, [lon, lat])).toBe(true);
    expect(lon).toBeGreaterThan(0);
  });

  it("names the missing feature when a symbol has no shape", () => {
    expect(() => centerOf(usStates, "states", "Puerto Rico")).toThrow(
      'No feature in "states" is named "Puerto Rico".',
    );
  });
});
