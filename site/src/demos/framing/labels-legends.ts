/**
 * Demos for the labels and legends page (docs/framing/labels-legends): value
 * labels with a density and format, a legend placed on top, and labels inside
 * the bands of a stacked area in place of a legend.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";

export const labelsValues = defineDemo({
  id: "framing/labels-values",
  title: "Quarterly US inflation with value labels",
  source: sourceOf(usInflation),
  height: 420,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: usInflation.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
      y: { field: "rate", type: "quantitative", axis: false },
    },
    labels: { density: "auto", format: ".1f" },
    chrome: {
      title: "US inflation was above 3% for 13 straight quarters, from mid-2021 to mid-2024",
      subtitle: "Consumer price index, % change from a year earlier, quarterly, 2019–2024",
    },
  },
});

const SOURCE_ORDER = ["Gas", "Coal", "Nuclear", "Wind", "Hydro", "Solar"];
const mixRows = electricityMixMatrix.data.map((row) => ({ ...row }));
const mixSubtitle = "Share of US generation by source (%), 2016–2023";

export const legendTop = defineDemo({
  id: "framing/legend-top",
  title: "US electricity mix by year with the legend on top",
  source: sourceOf(electricityMixMatrix),
  height: 460,
  spec: {
    mark: "bar",
    data: mixRows,
    encoding: {
      x: { field: "year", type: "ordinal" },
      // Explicit: with the default stack the y domain stops at the largest single share.
      y: {
        field: "share",
        type: "quantitative",
        stack: "zero",
        axis: { title: "Share of generation", format: ".0f", labelSuffix: "%" },
      },
      color: { field: "source", type: "nominal", scale: { domain: SOURCE_ORDER } },
    },
    labels: false,
    legend: { position: "top" },
    chrome: {
      title: "Gas made up 43.5% of US electricity in 2023, more than coal and nuclear combined",
      subtitle: mixSubtitle,
    },
  },
});

const interiorArea: ChartSpec = {
  mark: "area",
  data: mixRows,
  encoding: {
    x: { field: "year", type: "temporal", axis: { format: "%Y" } },
    y: {
      field: "share",
      type: "quantitative",
      axis: { title: "Share of generation", format: ".0f", labelSuffix: "%" },
    },
    color: { field: "source", type: "nominal", scale: { domain: SOURCE_ORDER } },
  },
  legend: { show: false },
  endpointLabels: { content: "label" },
  chrome: {
    title: "Gas's share of US electricity grew from 34.8% in 2016 to 43.5% in 2023",
    subtitle: mixSubtitle,
  },
};

export const labelsDirect = defineDemo({
  id: "framing/labels-direct",
  title: "US electricity mix as a stacked area with labels in the bands",
  source: sourceOf(electricityMixMatrix),
  height: 460,
  spec: interiorArea,
});
