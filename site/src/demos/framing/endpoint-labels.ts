/**
 * Demos for the endpoint labels page (docs/framing/endpoint-labels): the four
 * largest US electricity sources with names, values, both, and one series in
 * focus.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import type { ChartSpec, EndpointLabelsConfig } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";
const GREY = "#7a858f";
const source = sourceOf(electricityMixMatrix);

// Hydro and solar both end at 5.8% and would share one label slot, so the page keeps the four largest sources.
const LARGEST = ["Gas", "Nuclear", "Coal", "Wind"];
const largestRows = electricityMixMatrix.data
  .filter((row) => LARGEST.includes(row.source))
  .map((row) => ({ ...row }));

const SUBTITLE = "Share of US generation from the four largest sources (%), 2016–2023";

/** What changes between the four figures: the endpoint labels, the chrome and, for the focus figure, color and stroke. */
type SourceLinesOptions = {
  endpointLabels: EndpointLabelsConfig;
  chrome: ChartSpec["chrome"];
  /** Colors in `LARGEST` order. */
  colorRange?: string[];
  legend?: ChartSpec["legend"];
  seriesStyles?: ChartSpec["seriesStyles"];
};

/** The four source lines with one figure's settings. */
const sourceLines = ({
  endpointLabels,
  chrome,
  colorRange,
  legend,
  seriesStyles,
}: SourceLinesOptions): ChartSpec => ({
  mark: { type: "line", strokeWidth: 2 },
  data: largestRows,
  encoding: {
    x: { field: "year", type: "temporal", axis: { format: "%Y" } },
    y: {
      field: "share",
      type: "quantitative",
      axis: { title: "Share of generation", format: ".0f", labelSuffix: "%" },
    },
    color: {
      field: "source",
      type: "nominal",
      ...(colorRange ? { scale: { domain: LARGEST, range: colorRange } } : {}),
    },
  },
  endpointLabels,
  ...(legend ? { legend } : {}),
  ...(seriesStyles ? { seriesStyles } : {}),
  chrome,
});

export const endpointNames = defineDemo({
  id: "framing/endpoint-names",
  title: "Four US electricity sources labeled by name",
  source,
  height: 420,
  spec: sourceLines({
    endpointLabels: { content: "label" },
    chrome: {
      title: "Gas was the largest source of US electricity in every year from 2016 to 2023",
      subtitle: SUBTITLE,
    },
  }),
});

export const endpointValues = defineDemo({
  id: "framing/endpoint-values",
  title: "Four US electricity sources labeled by 2023 share",
  source,
  height: 440,
  spec: sourceLines({
    endpointLabels: { content: "value", format: ".1f" },
    legend: { show: true, position: "top" },
    chrome: {
      title: "Wind's share of US electricity reached 10.1% in 2023, up from 5.7% in 2016",
      subtitle: SUBTITLE,
    },
  }),
});

export const endpointBoth = defineDemo({
  id: "framing/endpoint-both",
  title: "Four US electricity sources labeled by name and 2023 share",
  source,
  height: 420,
  spec: sourceLines({
    endpointLabels: { format: ".1f" },
    chrome: {
      title: "Coal fell to 16.2% of US electricity in 2023, behind gas and nuclear",
      subtitle: SUBTITLE,
    },
  }),
});

export const endpointFocus = defineDemo({
  id: "framing/endpoint-focus",
  title: "US electricity sources with gas in focus",
  source,
  height: 420,
  spec: sourceLines({
    endpointLabels: { content: "label value", format: ".1f" },
    // Gas comes first in LARGEST, so it takes the accent and the rest turn grey.
    colorRange: [ACCENT, GREY, GREY, GREY],
    seriesStyles: { Gas: { strokeWidth: 3 } },
    chrome: {
      title: "Gas's share of US electricity rose by 8.7 points from 2016 to 2023",
      subtitle: SUBTITLE,
    },
  }),
});
