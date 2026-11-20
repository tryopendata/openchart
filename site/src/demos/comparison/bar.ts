/**
 * Demos for the bar chart page (docs/comparison/bar). Specs follow the Ladle
 * bar and column gallery; each takes its data and citation from one dataset
 * module in examples/src/data.
 */
import { householdSpending } from "@datasets/household-spending";
import { populationByCountry } from "@datasets/population";
import { renewableCapacityAdditions } from "@datasets/renewable-capacity";
import { sp500SectorReturns } from "@datasets/sp500-sectors";
import { type DemoSource, defineDemo } from "../types";

/** A dataset's citation as a figure source; the figure caption adds the "Source:" prefix. */
function sourceOf(dataset: { source: string; url: string }): DemoSource {
  return { label: dataset.source.replace(/^Source:\s*/, ""), url: dataset.url };
}

const BILLION = 1_000_000_000;

export const basicBar = defineDemo({
  id: "comparison/bar-basic",
  title: "Population by country",
  source: sourceOf(populationByCountry),
  spec: {
    mark: "bar",
    data: [...populationByCountry.data],
    encoding: {
      x: {
        field: "population",
        type: "quantitative",
        axis: { title: "Population", format: ".2~s" },
      },
      y: { field: "country", type: "nominal" },
    },
    chrome: {
      title: "The ten most populous countries",
      subtitle: "Population by country, 2025 estimates",
    },
  },
});

export const sortedBar = defineDemo({
  id: "comparison/bar-sorted",
  title: "Population by country, ranked",
  source: sourceOf(populationByCountry),
  spec: {
    mark: "bar",
    data: [...populationByCountry.data],
    encoding: {
      x: {
        field: "population",
        type: "quantitative",
        axis: { title: "Population", format: ".2~s" },
      },
      y: { field: "country", type: "nominal", sort: "x" },
    },
    chrome: {
      title: "India and China are each four times the size of the US",
      subtitle: "Population by country, 2025 estimates",
    },
  },
});

export const groupedBar = defineDemo({
  id: "comparison/bar-grouped",
  title: "Renewable capacity added by source",
  source: sourceOf(renewableCapacityAdditions),
  height: 440,
  spec: {
    mark: "bar",
    data: [...renewableCapacityAdditions.data],
    encoding: {
      x: { field: "year", type: "nominal" },
      y: {
        field: "capacity",
        type: "quantitative",
        stack: null,
        axis: { title: "Capacity added (GW)" },
      },
      color: { field: "type", type: "nominal" },
    },
    labels: { density: "none" },
    chrome: {
      title: "Solar is running away with the energy transition",
      subtitle: "Global renewable capacity additions by source, 2019-2023 (gigawatts)",
    },
  },
});

export const stackedBar = defineDemo({
  id: "comparison/bar-stacked",
  title: "Household spending by income bracket",
  source: sourceOf(householdSpending),
  height: 440,
  spec: {
    mark: "bar",
    data: [...householdSpending.data],
    encoding: {
      x: {
        field: "pct",
        type: "quantitative",
        stack: "zero",
        axis: { title: "Share of spending (%)" },
      },
      y: { field: "bracket", type: "nominal" },
      color: { field: "category", type: "nominal" },
    },
    chrome: {
      title: "The poorer you are, the more housing eats your paycheck",
      subtitle: "Share of annual household expenditure by category and income bracket, 2022 (%)",
    },
  },
});

// The data has no sign field, so the color scale needs one derived per row.
const sectorReturns = sp500SectorReturns.data.map((row) => ({
  ...row,
  direction: row.return >= 0 ? "Gain" : "Loss",
}));

export const labelledBar = defineDemo({
  id: "comparison/bar-labels",
  title: "S&P 500 return by sector",
  source: sourceOf(sp500SectorReturns),
  height: 460,
  spec: {
    mark: "bar",
    data: sectorReturns,
    encoding: {
      x: {
        field: "return",
        type: "quantitative",
        axis: { title: "Total return (%)", format: "+.0f" },
      },
      y: { field: "sector", type: "nominal", sort: "x" },
      color: {
        field: "direction",
        type: "nominal",
        scale: { domain: ["Gain", "Loss"], range: ["#0e7490", "#d1495b"] },
      },
    },
    legend: { show: false },
    labels: { format: "+.1f" },
    annotations: [{ type: "refline", x: 0, style: "solid", strokeWidth: 1.5 }],
    chrome: {
      title: "Only materials ended 2024 in the red",
      subtitle: "S&P 500 total return by sector, full year 2024",
    },
  },
});

export const highlightedBar = defineDemo({
  id: "comparison/bar-highlight",
  title: "India and China against the 1 billion mark",
  source: sourceOf(populationByCountry),
  height: 440,
  spec: {
    mark: "bar",
    data: [...populationByCountry.data],
    encoding: {
      x: {
        field: "population",
        type: "quantitative",
        axis: { title: "Population", format: ".2~s" },
      },
      y: { field: "country", type: "nominal", sort: "x" },
      color: { field: "country", type: "nominal", highlight: ["India", "China"] },
    },
    legend: { show: false },
    annotations: [
      {
        type: "refline",
        x: BILLION,
        label: "1 billion",
        labelPlacement: "outside",
        style: "dashed",
      },
    ],
    chrome: {
      title: "India has overtaken China as the most populous country",
      subtitle: "Population by country, 2025 estimates",
    },
  },
});
