/**
 * Demos for the choropleth page (docs/maps/choropleth). Specs follow the Ladle
 * maps gallery: a US state map, a world map under an equal-area projection, and
 * a diverging scale joined by state name. Each map's geography is the reduced
 * atlas from geography.ts, and its data one dataset module from examples/src/data.
 */
import { statePopulationChange } from "@datasets/state-population-change";
import { usUnemployment } from "@datasets/us-unemployment";
import { worldGdp } from "@datasets/world-gdp";
import { defineDemo } from "../types";
import { usStates, worldCountries } from "./geography";
import { sourceWithGeography } from "./sources";

export const basicChoropleth = defineDemo({
  id: "maps/choropleth-basic",
  title: "Unemployment rate by state",
  source: sourceWithGeography(usUnemployment, "us"),
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
    chrome: {
      title: "Unemployment is highest in DC and lowest in South Dakota",
      subtitle: "Unemployment rate by state (%)",
    },
  },
});

export const worldChoropleth = defineDemo({
  id: "maps/choropleth-world",
  title: "GDP per capita for 30 countries",
  caption:
    "GDP per capita for 30 countries; the rest show the no-data fill. Antarctica is left out",
  source: sourceWithGeography(worldGdp, "world"),
  height: 440,
  spec: {
    type: "map",
    geo: { features: worldCountries, projection: "equalEarth" },
    data: [...worldGdp.data],
    encoding: {
      key: { field: "id", type: "nominal" },
      color: { field: "gdp", type: "quantitative", format: "$,.0f", title: "GDP per capita" },
    },
    legend: { position: "right" },
    chrome: {
      title: "Switzerland tops these 30 countries at $99,994",
      subtitle: "GDP per capita, current US dollars, 2023",
    },
  },
});

export const divergingChoropleth = defineDemo({
  id: "maps/choropleth-diverging",
  title: "Population change by state, joined by name",
  source: sourceWithGeography(statePopulationChange, "us"),
  height: 460,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa", idField: "name" },
    data: [...statePopulationChange.data],
    encoding: {
      key: { field: "state", type: "nominal" },
      color: {
        field: "change",
        type: "quantitative",
        format: "+.1f",
        title: "Population change (%)",
        scale: { scheme: "redBlue" },
      },
    },
    chrome: {
      title: "Idaho, Florida, Texas and Montana grew by 7.5% or more",
      subtitle: "Population change, April 2020 to July 2024 (%), for 13 states",
    },
  },
});
