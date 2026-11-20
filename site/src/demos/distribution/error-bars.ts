/**
 * Demos for the error bars page (docs/distribution/error-bars). Specs follow the
 * errorbar section of docs/chart-types.md. The library draws bounds it is given,
 * so the real-data demos use a dataset that carries a low and a high per row.
 */

import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import type { ChartSpec, LayerSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { ILLUSTRATIVE } from "./shared";

const temperatureCaption =
  "The bars span each month's average daily low to its average daily high, both supplied in the data.";

const temperatureAxis = { title: "Temperature (°C)" };

export const basicErrorBars = defineDemo({
  id: "distribution/errorbars-basic",
  title: "Monthly temperature range",
  source: sourceOf(nycTemperatureRange),
  caption: temperatureCaption,
  spec: {
    mark: "errorbar",
    data: [...nycTemperatureRange.data],
    encoding: {
      x: { field: "month", type: "nominal" },
      y: { field: "low", type: "quantitative", axis: temperatureAxis },
      y2: { field: "high", type: "quantitative" },
    },
    chrome: {
      title: "New York swings 30 degrees across the year",
      subtitle: "Average daily low to high temperature by month, Central Park, 2023",
    },
  },
});

export const cappedErrorBars = defineDemo({
  id: "distribution/errorbars-caps",
  title: "Monthly temperature range with end caps",
  source: sourceOf(nycTemperatureRange),
  caption: temperatureCaption,
  spec: {
    mark: { type: "errorbar", ticks: true },
    data: [...nycTemperatureRange.data],
    encoding: {
      x: { field: "month", type: "nominal" },
      y: { field: "low", type: "quantitative", axis: temperatureAxis },
      y2: { field: "high", type: "quantitative" },
    },
    chrome: {
      title: "End caps mark where each interval stops",
      subtitle: "Average daily low to high temperature by month, Central Park, 2023",
    },
  },
});

export const horizontalErrorBars = defineDemo({
  id: "distribution/errorbars-horizontal",
  title: "Monthly temperature range, horizontal",
  source: sourceOf(nycTemperatureRange),
  caption: temperatureCaption,
  height: 480,
  spec: {
    mark: { type: "errorbar", ticks: true },
    data: [...nycTemperatureRange.data],
    encoding: {
      y: { field: "month", type: "nominal" },
      x: { field: "low", type: "quantitative", axis: temperatureAxis },
      x2: { field: "high", type: "quantitative" },
    },
    chrome: {
      title: "The same intervals on a horizontal axis",
      subtitle: "Average daily low to high temperature by month, Central Park, 2023",
    },
  },
});

const passRates = [
  { agent: "Claude", lower: 0.62, upper: 0.9, value: 0.8 },
  { agent: "Codex", lower: 0.7, upper: 0.96, value: 0.88 },
];

const interval: ChartSpec = {
  mark: { type: "errorbar", ticks: true },
  data: passRates,
  encoding: {
    x: {
      field: "lower",
      type: "quantitative",
      scale: { domain: [0, 1] },
      axis: { title: "Pass rate", format: ".0%" },
    },
    x2: { field: "upper", type: "quantitative" },
    y: { field: "agent", type: "nominal" },
  },
};

// A point mark draws a trend line by default, which would cross the two estimates.
const estimate: ChartSpec = {
  mark: { type: "point", trendline: false },
  data: passRates,
  encoding: {
    x: { field: "value", type: "quantitative" },
    y: { field: "agent", type: "nominal" },
  },
};

const layered: LayerSpec = {
  layer: [interval, estimate],
  chrome: {
    title: "A layered point shows the estimate inside its interval",
    subtitle: "Pass rate with a supplied interval",
  },
};

export const estimateErrorBars = defineDemo({
  id: "distribution/errorbars-estimate",
  title: "Estimates with intervals",
  source: ILLUSTRATIVE,
  caption: "Two invented pass rates, each with an invented interval.",
  height: 300,
  spec: layered,
});
