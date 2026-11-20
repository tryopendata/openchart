/**
 * Demos for the 100% stacked page (docs/part-to-whole/stacked-100). The bar
 * and column specs follow the Ladle bar and column gallery with
 * `stack: "normalize"`, the value documented in docs/chart-types.md.
 */
import { householdSpending } from "@datasets/household-spending";
import { renewableCapacityAdditions } from "@datasets/renewable-capacity";
import { segmentRevenue } from "@datasets/segment-revenue";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const normalizedBars = defineDemo({
  id: "part-to-whole/stacked-100-bars",
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
        stack: "normalize",
        axis: { title: "Share of spending", format: ".0%" },
      },
      y: { field: "bracket", type: "nominal" },
      color: { field: "category", type: "nominal" },
    },
    chrome: {
      title: "The poorer you are, the more housing eats your paycheck",
      subtitle: "Share of annual household expenditure by category and income bracket, 2022",
    },
  },
});

export const normalizedColumns = defineDemo({
  id: "part-to-whole/stacked-100-columns",
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
        stack: "normalize",
        axis: { title: "Share of capacity added", format: ".0%" },
      },
      color: { field: "type", type: "nominal" },
    },
    chrome: {
      title: "Solar was more than half of new capacity in every year",
      subtitle: "Global renewable capacity additions by source, 2019-2023 (share of gigawatts)",
    },
  },
});

export const normalizedRevenue = defineDemo({
  id: "part-to-whole/stacked-100-quarters",
  title: "Revenue mix by quarter",
  source: sourceOf(segmentRevenue),
  height: 440,
  spec: {
    mark: "bar",
    data: [...segmentRevenue.data],
    encoding: {
      x: { field: "quarter", type: "ordinal" },
      y: {
        field: "revenue",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of revenue", format: ".0%" },
      },
      color: { field: "segment", type: "nominal" },
    },
    labels: { density: "none" },
    chrome: {
      title: "Devices take a bigger share in each fourth quarter",
      subtitle: "Quarterly revenue by business segment, 2022-2024 (share of total)",
    },
  },
});
