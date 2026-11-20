/**
 * The geography every map demo draws, reduced from the atlas packages so a
 * page of maps stays small (see topology.ts). US states come from us-atlas
 * (Census Bureau cartographic boundaries) and countries from world-atlas
 * (Natural Earth, 1:110m), both unprojected, so the maps choose their
 * projection and can place points by longitude and latitude.
 */
import type { Topology } from "topojson-specification";
import usAtlas from "us-atlas/states-10m.json";
import worldAtlas from "world-atlas/countries-110m.json";
import { type AtlasTopology, type CoarsenOptions, coarsenTopology } from "./topology";

// The JSON modules are typed from their contents, which TypeScript widens to
// plain strings and arrays; their shape is the atlas format AtlasTopology names.
const usStatesAtlas = usAtlas as unknown as AtlasTopology;
const worldCountriesAtlas = worldAtlas as unknown as AtlasTopology;

/** FIPS codes from 60 up are territories, which the albersUsa projection leaves out. */
const isStateOrDc = (id: unknown) => Number(id) < 60;

/** US states: simplified to a quarter degree, less for small states. */
const US_STATES: CoarsenOptions = {
  object: "states",
  keep: (geometry) => isStateOrDc(geometry.id),
  tolerance: 0.25,
  relativeTolerance: 0.1,
  minArea: 0.1,
};

/**
 * World reduction: up to 0.8 degrees of simplification on large countries,
 * capped by `relativeTolerance` on small ones so each keeps at least 80% of its
 * area, and islands under 3 square degrees dropped. Exported for the tests.
 */
export const WORLD_COUNTRIES: CoarsenOptions = {
  object: "countries",
  keep: (geometry) => geometry.properties?.name !== "Antarctica",
  tolerance: 0.8,
  relativeTolerance: 0.1,
  minArea: 3,
};

/** The 50 states and DC, keyed by two-digit FIPS code, with `name` properties. Object "states". */
export const usStates: Topology = coarsenTopology(usStatesAtlas, US_STATES);

/**
 * The states as a basemap under symbols: islands under half a square degree
 * are dropped as well, since no data colors them.
 */
export const usStatesBasemap: Topology = coarsenTopology(usStatesAtlas, {
  ...US_STATES,
  minArea: 0.5,
});

/** The names of ten states in the Southeast, for a regional map. */
export const SOUTHEAST = [
  "Alabama",
  "Florida",
  "Georgia",
  "Kentucky",
  "Mississippi",
  "North Carolina",
  "South Carolina",
  "Tennessee",
  "Virginia",
  "West Virginia",
];

/** The ten Southeast states alone, so the map fits them. Object "states". */
export const southeastStates: Topology = coarsenTopology(usStatesAtlas, {
  ...US_STATES,
  keep: (geometry) => SOUTHEAST.includes(String(geometry.properties?.name)),
});

/** Countries keyed by ISO 3166-1 numeric code, with `name` properties, except Antarctica. Object "countries". */
export const worldCountries: Topology = coarsenTopology(worldCountriesAtlas, WORLD_COUNTRIES);

/** All land as one shape, for a basemap under symbols. Object "land". */
export const worldLand: Topology = coarsenTopology(worldCountriesAtlas, {
  ...WORLD_COUNTRIES,
  object: "land",
  keep: undefined,
});
