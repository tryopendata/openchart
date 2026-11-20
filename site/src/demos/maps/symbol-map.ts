/**
 * Demos for the symbol map page (docs/maps/symbol-map). Specs follow the point
 * layer in the Ladle maps gallery. The datasets name states and countries but
 * carry no coordinates, so each symbol sits at the center of its shape in the
 * same geography the map draws (centers.ts).
 */
import { populationByCountry } from "@datasets/population";
import { stateEconomies } from "@datasets/state-economies";
import { usUnemployment } from "@datasets/us-unemployment";
import { defineDemo } from "../types";
import { centerOf } from "./centers";
import { usStates, worldCountries, worldLand } from "./geography";
import { sourceOf, sourceWithGeography } from "./sources";

/** The ten largest state economies, each placed at the center of its state. */
const statePoints = stateEconomies.data.map((row) => ({
  ...row,
  ...centerOf(usStates, "states", row.state),
}));

/** Where world-atlas names a country differently from the dataset. */
const ATLAS_NAMES: Record<string, string> = { "United States": "United States of America" };

/** The ten most populous countries, each placed at the center of its country. */
const countryPoints = populationByCountry.data.map((row) => ({
  ...row,
  ...centerOf(worldCountries, "countries", ATLAS_NAMES[row.country] ?? row.country),
}));

const longitude = { field: "lon", type: "quantitative" } as const;
const latitude = { field: "lat", type: "quantitative" } as const;
const stateKey = { field: "label", type: "nominal" } as const;
const gdpSize = { field: "gdp", type: "quantitative", title: "GDP ($ trillions)" } as const;
const stateTooltip = [
  { field: "state", type: "nominal", title: "State" },
  { field: "gdp", type: "quantitative", title: "GDP ($ trillions)" },
  { field: "pop", type: "quantitative", title: "Population (millions)" },
] as const;

export const basicSymbolMap = defineDemo({
  id: "maps/symbol-basic",
  title: "GDP of the ten largest state economies",
  source: sourceWithGeography(stateEconomies, "us"),
  height: 440,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa" },
    data: [],
    encoding: { key: { field: "id", type: "nominal" } },
    points: {
      data: statePoints,
      longitude,
      latitude,
      size: gdpSize,
      key: stateKey,
      tooltip: [...stateTooltip],
    },
    chrome: {
      title: "California's economy is half again the size of Texas's",
      subtitle: "GDP of the ten largest state economies, 2023 ($ trillions)",
    },
  },
});

export const coloredSymbolMap = defineDemo({
  id: "maps/symbol-color",
  title: "State GDP sized, population colored",
  source: sourceWithGeography(stateEconomies, "us"),
  height: 440,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa" },
    data: [],
    encoding: { key: { field: "id", type: "nominal" } },
    points: {
      data: statePoints,
      longitude,
      latitude,
      size: gdpSize,
      color: { field: "pop", type: "quantitative", title: "Population (millions)" },
      key: stateKey,
      tooltip: [...stateTooltip],
    },
    legend: { position: "bottom-right" },
    chrome: {
      title: "Florida has more people than New York and a smaller economy",
      subtitle: "Ten largest state economies, 2023: size is GDP, color is population",
    },
  },
});

export const worldSymbolMap = defineDemo({
  id: "maps/symbol-world",
  title: "The ten most populous countries",
  source: sourceWithGeography(populationByCountry, "world"),
  height: 420,
  spec: {
    type: "map",
    geo: { features: worldLand, projection: "equalEarth" },
    data: [],
    encoding: { key: { field: "id", type: "nominal" } },
    points: {
      data: countryPoints,
      longitude,
      latitude,
      size: { field: "population", type: "quantitative", title: "Population" },
      key: { field: "country", type: "nominal" },
      tooltip: [
        { field: "country", type: "nominal", title: "Country" },
        { field: "population", type: "quantitative", title: "Population", format: ",.0f" },
      ],
    },
    chrome: {
      title: "India and China each hold more than 1.4 billion people",
      subtitle: "Population of the ten most populous countries, 2025",
    },
  },
});

export const symbolsOverChoropleth = defineDemo({
  id: "maps/symbol-over-choropleth",
  title: "State GDP over the unemployment rate",
  source: {
    label: `${sourceOf(usUnemployment).label}; ${sourceWithGeography(stateEconomies, "us").label}`,
  },
  height: 460,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa" },
    data: [...usUnemployment.data],
    encoding: {
      key: { field: "id", type: "nominal" },
      color: {
        field: "rate",
        type: "quantitative",
        format: ".1f",
        title: "Unemployment rate (%)",
      },
    },
    points: {
      data: statePoints,
      longitude,
      latitude,
      size: gdpSize,
      key: stateKey,
      tooltip: [...stateTooltip],
    },
    chrome: {
      title: "Eight of the ten largest state economies have unemployment above 4%",
      subtitle: "Unemployment rate (%) by state, with GDP of the ten largest state economies",
    },
  },
});
