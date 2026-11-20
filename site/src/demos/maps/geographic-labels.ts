/**
 * Demos for the geographic labels page (docs/maps/geographic-labels). Specs
 * follow the Ladle geographic-labels gallery and docs/geographic-labels.md:
 * feature names from a topology property, point names from point data, and
 * authored callouts anchored to features, including one that waits for zoom.
 */
import { stateEconomies } from "@datasets/state-economies";
import { usUnemployment } from "@datasets/us-unemployment";
import { defineDemo } from "../types";
import { centerOf } from "./centers";
import { usStates, usStatesBasemap } from "./geography";
import { sourceWithGeography } from "./sources";

const unemploymentColor = {
  field: "rate",
  type: "quantitative",
  format: ".1f",
  title: "Unemployment rate (%)",
} as const;

export const featureLabels = defineDemo({
  id: "maps/labels-features",
  title: "State names on an unemployment map",
  source: sourceWithGeography(usUnemployment, "us"),
  height: 480,
  // The heaviest static SVG on its page, so it draws in the browser and the page keeps size headroom.
  static: false,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa" },
    data: [...usUnemployment.data],
    encoding: {
      key: { field: "id", type: "nominal" },
      color: unemploymentColor,
      text: { field: "name", type: "nominal" },
      textPriority: { field: "rate", type: "quantitative" },
    },
    chrome: {
      title: "Every state name that fits, placed highest rate first",
      subtitle: "Unemployment rate by state (%); names come from the atlas",
    },
  },
});

const statePoints = stateEconomies.data.map((row) => ({
  ...row,
  ...centerOf(usStates, "states", row.state),
}));

export const pointLabels = defineDemo({
  id: "maps/labels-points",
  title: "The ten largest state economies, named",
  source: sourceWithGeography(stateEconomies, "us"),
  height: 460,
  spec: {
    type: "map",
    geo: { features: usStatesBasemap, projection: "albersUsa" },
    data: [],
    encoding: { key: { field: "id", type: "nominal" } },
    points: {
      data: statePoints,
      longitude: { field: "lon", type: "quantitative" },
      latitude: { field: "lat", type: "quantitative" },
      size: { field: "gdp", type: "quantitative", title: "GDP ($ trillions)" },
      key: { field: "label", type: "nominal" },
      text: { field: "state", type: "nominal" },
    },
    chrome: {
      title: "California and Texas lead the state economies",
      subtitle: "GDP of the ten largest state economies, 2023 ($ trillions)",
    },
  },
});

export const callouts = defineDemo({
  id: "maps/labels-callouts",
  title: "Callouts on the highest and lowest rates",
  source: sourceWithGeography(usUnemployment, "us"),
  height: 480,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa", zoom: true },
    data: [...usUnemployment.data],
    encoding: { key: { field: "id", type: "nominal" }, color: unemploymentColor },
    callouts: [
      {
        id: "highest",
        anchor: { kind: "feature", id: "11" },
        text: "DC: 5.7%",
        priority: 10,
      },
      {
        id: "lowest",
        anchor: { kind: "feature", id: "46" },
        text: "South Dakota: 2.3%",
        priority: 9,
      },
      {
        id: "rhode-island",
        anchor: { kind: "feature", id: "44" },
        text: "Rhode Island: 4.9%",
        minZoom: 3,
        maxWidth: 160,
      },
    ],
    chrome: {
      title: "Unemployment runs from 2.3% to 5.7%",
      subtitle: "Unemployment rate by state (%); zoom in on New England for one more note",
    },
  },
});
