/**
 * Demos for the choropleth page (docs/maps/choropleth). Specs follow the Ladle
 * maps gallery: a US state map, a world map under an equal-area projection, and
 * a diverging scale joined by state name. Each map's geography is the reduced
 * atlas from geography.ts, and its data one dataset module from examples/src/data.
 */
import { statePopulationChange } from "@datasets/state-population-change";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { worldGdp } from "@datasets/world-gdp";
import { defineDemo } from "../types";
import { SOUTHEAST, southeastStates, usStates, worldCountries } from "./geography";
import { sourceWithGeography } from "./sources";
import { rowsByFips } from "./state-fips";

export const basicChoropleth = defineDemo({
  id: "maps/choropleth-basic",
  title: "Unemployment rate by state",
  source: sourceWithGeography(usStateUnemployment, "us"),
  height: 460,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa" },
    data: rowsByFips(usStateUnemployment.data, "rate"),
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
  // The dataset's own header calls its values approximate, so the caption says so.
  source: sourceWithGeography({ source: `${worldGdp.source}, approximate values` }, "world"),
  height: 440,
  // The world's coastlines make the heaviest static SVG on the page; it draws in the browser instead.
  static: false,
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

/** The dataset's rows for the Southeast states the regional map draws. */
const southeastChange = statePopulationChange.data.filter((row) => SOUTHEAST.includes(row.state));

export const divergingChoropleth = defineDemo({
  id: "maps/choropleth-diverging",
  title: "Population change in the Southeast, joined by name",
  caption:
    "Population change in ten Southeast states, joined by state name. The dataset covers 5 of them",
  source: sourceWithGeography(statePopulationChange, "us"),
  height: 440,
  spec: {
    type: "map",
    geo: { features: southeastStates, projection: "albersUsa", idField: "name" },
    data: southeastChange,
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
    legend: { position: "right" },
    chrome: {
      title: "Florida grew fastest of these five states; West Virginia shrank",
      subtitle: "Population change, April 2020 to July 2024 (%)",
    },
  },
});
