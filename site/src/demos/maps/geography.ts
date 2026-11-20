/**
 * The geography every map demo draws, reduced from the atlas packages so a
 * page of maps stays small (see topology.ts). US states come from us-atlas (Census Bureau cartographic boundaries) and
 * countries from world-atlas (Natural Earth, 1:110m), both unprojected, so the
 * maps choose their projection and can place points by longitude and latitude.
 */
import type { Topology } from "topojson-specification";
import usAtlas from "us-atlas/states-10m.json";
import worldAtlas from "world-atlas/countries-110m.json";
import { type AtlasTopology, coarsenTopology } from "./topology";

// The JSON modules are typed from their contents, which TypeScript widens to
// plain strings and arrays; their shape is the atlas format AtlasTopology names.
const usStatesAtlas = usAtlas as unknown as AtlasTopology;
const worldCountriesAtlas = worldAtlas as unknown as AtlasTopology;

/** FIPS codes from 60 up are territories, which the albersUsa projection leaves out. */
const isStateOrDc = (id: unknown) => Number(id) < 60;

/** The 50 states and DC, keyed by two-digit FIPS code, with `name` properties. Object "states". */
export const usStates: Topology = coarsenTopology(usStatesAtlas, {
  object: "states",
  keep: (geometry) => isStateOrDc(geometry.id),
  tolerance: 0.25,
  minArea: 0.1,
});

/** Countries keyed by ISO 3166-1 numeric code, with `name` properties, except Antarctica. Object "countries". */
export const worldCountries: Topology = coarsenTopology(worldCountriesAtlas, {
  object: "countries",
  keep: (geometry) => geometry.properties?.name !== "Antarctica",
  tolerance: 1.2,
  minArea: 3,
});

/** All land as one shape, for a basemap under symbols. Object "land". */
export const worldLand: Topology = coarsenTopology(worldCountriesAtlas, {
  object: "land",
  tolerance: 1.2,
  minArea: 3,
});
