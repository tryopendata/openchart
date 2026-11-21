/**
 * Demos for the labels and legends page (docs/framing/labels-legends): value
 * labels standing in for an axis, a legend placed on top, and a stacked area
 * that names each band at its right end in place of a legend.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { ACCENT, ELECTRICITY_SUBTITLE, INFLATION_SUBTITLE } from "../the-spec/shared";
import { defineDemo } from "../types";

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
    labels: { format: ".1f" },
    chrome: {
      title: "US inflation was above 3% for 13 straight quarters, from mid-2021 to mid-2024",
      subtitle: INFLATION_SUBTITLE,
    },
  },
});

// The order the rows list the sources in. The stack follows the rows, and the
// color domain sets the legend, so keeping the two the same makes them agree.
const SOURCE_ORDER = ["Coal", "Gas", "Nuclear", "Hydro", "Wind", "Solar"];
const mixRows = electricityMixMatrix.data.map((row) => ({ ...row }));

export const legendTop = defineDemo({
  id: "framing/legend-top",
  title: "Electricity mix by year with the legend on top",
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
      title:
        "Gas made up 43.5% of generation from the six main sources in 2023, more than coal and nuclear combined",
      subtitle: ELECTRICITY_SUBTITLE,
    },
  },
});

const endLabelledArea: ChartSpec = {
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
    title:
      "Gas's share of generation from the six main sources grew from 34.8% in 2016 to 43.5% in 2023",
    subtitle: ELECTRICITY_SUBTITLE,
  },
};

export const labelsDirect = defineDemo({
  id: "framing/labels-direct",
  title: "Electricity mix as a stacked area with labels at the end of each band",
  source: sourceOf(electricityMixMatrix),
  height: 460,
  spec: endLabelledArea,
});
