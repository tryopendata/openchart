/**
 * Demos for the bubble page (docs/correlation/bubble). Specs follow the bubble
 * and trend annotation stories in the Ladle scatter and distribution gallery.
 */
import { emissionsRenewables } from "@datasets/emissions-renewables";
import { wealthHealth } from "@datasets/wealth-health";
import { defineDemo } from "../types";
import { sourceOf } from "./shared";

const emissionsAxis = { title: "CO2 emissions per capita (tonnes)" };
const renewablesAxis = { title: "Renewable electricity share (%)" };

export const basicBubble = defineDemo({
  id: "correlation/bubble-basic",
  title: "Emissions and renewables, sized by population",
  source: sourceOf(emissionsRenewables),
  height: 460,
  spec: {
    mark: "point",
    data: [...emissionsRenewables.data],
    encoding: {
      x: { field: "co2", type: "quantitative", axis: emissionsAxis },
      y: { field: "renewables", type: "quantitative", axis: renewablesAxis },
      size: { field: "pop", type: "quantitative" },
    },
    chrome: {
      title: "Clean grids and low emissions rarely go together",
      subtitle:
        "CO2 emissions per capita vs. share of electricity from renewables, 2023. Circle size = population (millions).",
    },
  },
});

export const coloredBubble = defineDemo({
  id: "correlation/bubble-color",
  title: "Emissions and renewables, colored by continent",
  source: sourceOf(emissionsRenewables),
  height: 500,
  spec: {
    mark: "point",
    data: [...emissionsRenewables.data],
    encoding: {
      x: { field: "co2", type: "quantitative", axis: emissionsAxis },
      y: { field: "renewables", type: "quantitative", axis: renewablesAxis },
      size: { field: "pop", type: "quantitative" },
      color: { field: "continent", type: "nominal" },
      tooltip: [
        { field: "country", type: "nominal", title: "Country" },
        { field: "co2", type: "quantitative", title: "CO2 (t/person)" },
        { field: "renewables", type: "quantitative", title: "Renewables (%)" },
        { field: "pop", type: "quantitative", title: "Population (M)" },
      ],
    },
    annotations: [
      {
        type: "text",
        x: 14.7,
        y: 21,
        text: "The US has high emissions\nbut modest renewables",
        connector: true,
        anchor: "left",
        offset: { dx: -24, dy: -50 },
      },
      {
        type: "text",
        x: 2.3,
        y: 85,
        text: "Brazil's grid is nearly\nall renewable",
        connector: true,
        anchor: "right",
        offset: { dx: 24, dy: -18 },
      },
    ],
    chrome: {
      title: "Clean grids and low emissions rarely go together",
      subtitle:
        "CO2 emissions per capita vs. share of electricity from renewables, 2023. Circle size = population (millions).",
    },
  },
});

export const referenceBubble = defineDemo({
  id: "correlation/bubble-reference",
  title: "Wealth and life expectancy, with a reference line",
  source: sourceOf(wealthHealth),
  height: 500,
  spec: {
    mark: "point",
    data: [...wealthHealth.data],
    encoding: {
      x: {
        field: "gdpPerCapita",
        type: "quantitative",
        axis: { title: "GDP per capita (USD)", format: "$.2~s" },
      },
      y: {
        field: "lifeExpectancy",
        type: "quantitative",
        axis: { title: "Life expectancy (years)" },
      },
      color: { field: "region", type: "nominal" },
      size: { field: "pop", type: "quantitative" },
    },
    annotations: [
      {
        type: "refline",
        y: 73,
        label: "World avg: 73 yrs",
        labelAnchor: "left",
        style: "dashed",
        stroke: "#64748b",
        strokeWidth: 1,
      },
    ],
    chrome: {
      title: "Richer countries live longer, but America is an outlier",
      subtitle: "GDP per capita vs. life expectancy, 2022. Bubble size = population (millions).",
    },
  },
});
