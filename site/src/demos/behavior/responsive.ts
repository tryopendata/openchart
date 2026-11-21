/**
 * Demos for the responsive page (docs/behavior/responsive). One annotated US
 * inflation chart at full, medium and compact widths, then the `responsive`
 * settings at compact width: `preserveEnd` and `labelSummary` on a six-line
 * chart, and `compactAnnotationLimit` on the inflation chart. `width` sets
 * the layout width of the static render and caps the live stage.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** A phone-width layout, under the 400px compact breakpoint. */
const COMPACT = 360;
/** Between 400 and 700px: the medium breakpoint. */
const MEDIUM = 560;

const inflationSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2.5 },
  // Notes for thinned callouts fit inside the fixed stage height instead of growing past it.
  chromeLayout: "subtract",
  data: [...usInflation.data],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: {
      field: "rate",
      type: "quantitative",
      axis: { title: "Year-over-year change (%)", format: ".0f", grid: true },
    },
  },
  annotations: [
    {
      type: "text",
      x: "2022-07-01",
      y: 8.5,
      text: "Peak: 8.5%",
      anchor: "top",
      offset: { dx: 0, dy: -16 },
      connector: true,
    },
    {
      type: "text",
      x: "2020-04-01",
      y: 0.3,
      text: "Pandemic low: 0.3%",
      anchor: "right",
      offset: { dx: 12, dy: 0 },
      connector: true,
    },
    { type: "refline", y: 2, label: "Fed target, 2%", style: "dashed" },
  ],
  chrome: {
    title: "US inflation went from 0.3% in 2020 to a peak of 8.5% in 2022",
    subtitle: "Consumer price index, year-over-year change, %, quarterly 2019–2024",
  },
};

export const fullWidth = defineDemo({
  id: "behavior/responsive-full",
  title: "US inflation at full width",
  source: sourceOf(usInflation),
  height: 440,
  spec: inflationSpec,
});

export const mediumWidth = defineDemo({
  id: "behavior/responsive-medium",
  title: "US inflation at medium width",
  source: sourceOf(usInflation),
  height: 440,
  width: MEDIUM,
  spec: inflationSpec,
});

export const compactWidth = defineDemo({
  id: "behavior/responsive-compact",
  title: "US inflation at phone width",
  source: sourceOf(usInflation),
  height: 440,
  width: COMPACT,
  spec: inflationSpec,
});

export const annotationLimit = defineDemo({
  id: "behavior/responsive-annotation-limit",
  title: "US inflation at phone width with both callouts",
  source: sourceOf(usInflation),
  height: 440,
  width: COMPACT,
  spec: { ...inflationSpec, responsive: { compactAnnotationLimit: 2 } },
});

export const labelSummary = defineDemo({
  id: "behavior/responsive-summary",
  title: "US electricity mix at phone width",
  source: sourceOf(electricityMixMatrix),
  height: 460,
  width: COMPACT,
  spec: {
    mark: { type: "line", strokeWidth: 2 },
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "share",
        type: "quantitative",
        axis: { title: "Share of generation (%)", format: ".0f", grid: true },
      },
      color: { field: "source", type: "nominal" },
    },
    endpointLabels: { format: ".0f" },
    chromeLayout: "subtract",
    responsive: { preserveEnd: true, labelSummary: true },
    chrome: {
      title: "Wind has generated more US electricity than hydro every year since 2019",
      subtitle: "Share of generation from the six main sources, %, 2016–2023",
    },
  },
});
