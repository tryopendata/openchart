/**
 * Demos for the export page (docs/output/export): download buttons on a
 * heatmap and on a range chart, each saving the live chart as SVG, PNG or CSV.
 * Each takes its rows and citation from one verified dataset module.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const exportHeatmap = defineDemo({
  id: "output/export-heatmap",
  title: "US electricity mix by source and year",
  source: sourceOf(electricityMixMatrix),
  caption: "Darker cells are a larger share of the year's generation.",
  height: 400,
  spec: {
    mark: "rect",
    data: electricityMixMatrix.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "year", type: "nominal" },
      y: { field: "source", type: "nominal" },
      color: {
        field: "share",
        type: "quantitative",
        scale: { scheme: "blues" },
        format: ".1f",
      },
    },
    chrome: {
      title: "Coal's share of US electricity fell from 31% to 16% between 2016 and 2023",
      subtitle: "Share of US generation from six sources, by year (%)",
    },
  },
  controls: { exports: ["svg", "png", "csv"] },
});

export const exportRange = defineDemo({
  id: "output/export-range",
  title: "Monthly temperature range in Central Park",
  source: sourceOf(nycTemperatureRange),
  caption: "Each bar spans a month's average daily low to its average daily high.",
  height: 420,
  spec: {
    mark: { type: "errorbar", ticks: true },
    data: nycTemperatureRange.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "month", type: "nominal" },
      y: { field: "low", type: "quantitative", axis: { title: "Temperature (°C)" } },
      y2: { field: "high", type: "quantitative" },
    },
    chrome: {
      title: "New York's average daily high peaked at 30.2°C in July 2023",
      subtitle: "Average daily low to average daily high by month, Central Park, 2023 (°C)",
    },
  },
  controls: { exports: ["svg", "png", "csv"] },
});
