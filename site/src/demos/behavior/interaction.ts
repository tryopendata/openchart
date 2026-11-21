/**
 * Demos for the interaction page (docs/behavior/interaction): tooltips and a
 * crosshair on a line, legend toggles with an event log, and select mode with
 * an event log. Each takes its rows and citation from one verified dataset module.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { temperatureAnomaly } from "@datasets/temperature-anomaly";
import { usInflation } from "@datasets/us-inflation";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const crosshairLine = defineDemo({
  id: "behavior/interaction-crosshair",
  title: "US inflation by quarter",
  source: sourceOf(usInflation),
  caption: "Hover over the chart, or tab to it and use the arrow keys, to read each quarter.",
  height: 420,
  spec: {
    mark: { type: "line", strokeWidth: 2 },
    data: usInflation.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        axis: { title: "Inflation (%)", format: ".0f", grid: true },
      },
    },
    crosshair: true,
    chrome: {
      title: "US inflation peaked at 8.5% in the third quarter of 2022",
      subtitle: "US consumer prices, change from a year earlier, quarterly, 2019 to 2024 (%)",
    },
  },
});

export const legendToggle = defineDemo({
  id: "behavior/interaction-legend",
  title: "US electricity generation by source",
  source: sourceOf(electricityMixMatrix),
  caption: "Click a source in the legend to hide or show its line.",
  height: 440,
  spec: {
    mark: { type: "line", strokeWidth: 2 },
    data: electricityMixMatrix.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "share",
        type: "quantitative",
        axis: { title: "Share of generation (%)", grid: true },
      },
      color: { field: "source", type: "nominal" },
    },
    // Lines get end labels by default; the legend is what a reader clicks here.
    endpointLabels: false,
    legend: { position: "top" },
    chrome: {
      title: "Gas made 43.5% of generation from the six main sources in 2023, more than any other",
      subtitle:
        "Share of US generation from coal, gas, nuclear, hydro, wind and solar, 2016 to 2023 (%)",
    },
  },
  controls: { eventLog: true },
});

export const selectColumns = defineDemo({
  id: "behavior/interaction-select",
  title: "Global temperature anomaly",
  source: sourceOf(temperatureAnomaly),
  caption: "Click the title, the subtitle, the note or the average line to select it.",
  height: 440,
  spec: {
    mark: "bar",
    data: temperatureAnomaly.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "anomaly",
        type: "quantitative",
        axis: { title: "Difference from 20th-century average (°C)", format: "+.1f" },
      },
      color: {
        field: "trend",
        type: "nominal",
        scale: { domain: ["Cooler", "Warmer"], range: ["#3b82c4", "#d1495b"] },
      },
    },
    labels: { density: "none" },
    annotations: [
      { type: "refline", y: 0, label: "20th-century average", style: "solid", strokeWidth: 1 },
      {
        type: "text",
        x: "2025",
        y: 1.17,
        text: "+1.17°C",
        anchor: "top",
        offset: { dx: 0, dy: -8 },
      },
    ],
    chrome: {
      title: "Every reading since 1960 is above the 20th-century average",
      subtitle:
        "Global surface temperature, difference from the 20th-century average, 1900 to 2025 (°C)",
    },
  },
  mount: { interaction: "select" },
  controls: { eventLog: true },
});
