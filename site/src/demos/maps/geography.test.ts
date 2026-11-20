// The reduced atlases the map demos draw: they must keep every shape the maps
// join data to, never collapse a ring into a line (which a map projection reads
// as the whole globe), and place symbols inside their shapes.
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import usAtlas from "us-atlas/states-10m.json";
import { describe, expect, it } from "vitest";
import { centerOf } from "./centers";
import { usStates, worldCountries, worldLand } from "./geography";

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

  it("places a state's symbol inside that state's bounds", () => {
    const { lon, lat } = centerOf(usStates, "states", "California");
    expect(lon).toBeGreaterThan(-124.5);
    expect(lon).toBeLessThan(-114.1);
    expect(lat).toBeGreaterThan(32.5);
    expect(lat).toBeLessThan(42);
  });

  it("names the missing feature when a symbol has no shape", () => {
    expect(() => centerOf(usStates, "states", "Puerto Rico")).toThrow(
      'No feature in "states" is named "Puerto Rico".',
    );
  });
});
