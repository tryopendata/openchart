/**
 * The figures in the blog post "Direct labels vs legends: when to put text on
 * the chart": six US electricity generation sources with a top legend, then
 * the same six series with direct endpoint labels and coal in focus. Titles
 * are computed from the dataset rows so they cannot drift from the data. The
 * post's `json demo` fence repeats `directLabelsEndpoints.spec` verbatim, and
 * a test keeps the two in sync.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { ACCENT, ELECTRICITY_SUBTITLE, GREY } from "../the-spec/shared";
import { defineDemo } from "../types";

const rows = electricityMixMatrix.data;
const source = sourceOf(electricityMixMatrix);

const SOURCES = ["Coal", "Gas", "Nuclear", "Hydro", "Wind", "Solar"] as const;

const years = [...new Set(rows.map((row) => row.year))].sort();
const firstYear = years[0] ?? "";
const lastYear = years.at(-1) ?? "";

/** Looks up one source's share in a given year so chart titles derive directly from the rows. */
function shareOf(name: (typeof SOURCES)[number], year: string): number {
  const match = rows.find((row) => row.source === name && row.year === year);
  if (match?.share === undefined) {
    throw new Error(`Missing electricity share for ${name} in ${year}`);
  }
  return match.share;
}

const coalStart = shareOf("Coal", firstYear);
const coalEnd = shareOf("Coal", lastYear);
const gasEnd = shareOf("Gas", lastYear);

/** Shared subtitle naming the measure, the six included sources, and the year range. */
const subtitle = `${ELECTRICITY_SUBTITLE}, ${firstYear} to ${lastYear}`;

const baseEncoding = {
  x: { field: "year", type: "temporal", axis: { format: "%Y" } },
  y: {
    field: "share",
    type: "quantitative",
    axis: { title: "Share of generation", format: ".0f", labelSuffix: "%" },
  },
  color: { field: "source", type: "nominal" },
} satisfies ChartSpec["encoding"];

const baseLines: ChartSpec = {
  mark: { type: "line", strokeWidth: 2 },
  data: rows.map((row) => ({ ...row })),
  encoding: baseEncoding,
};

/** Multi-line chart of all six US electricity sources identified only by a top legend. */
export const directLabelsLegend = defineDemo({
  id: "blog/direct-labels-legend",
  title: "US electricity generation shares by source with a top legend",
  source,
  height: 440,
  spec: {
    ...baseLines,
    legend: { show: true, position: "top" },
    endpointLabels: false,
    chrome: {
      title: `Gas reached ${gasEnd.toFixed(1)}% of US main-source electricity in ${lastYear}, ahead of coal at ${coalEnd.toFixed(1)}%`,
      subtitle,
    },
  },
});

/**
 * The same six US electricity sources with direct endpoint labels, leader lines
 * for colliding endpoints (hydro and solar at 5.8%), and coal emphasized via an
 * explicit focal scale so all six series keep their endpoint labels.
 */
export const directLabelsEndpoints = defineDemo({
  id: "blog/direct-labels-endpoints",
  title: "US electricity generation shares with direct endpoint labels and coal in focus",
  source,
  height: 440,
  spec: {
    ...baseLines,
    encoding: {
      ...baseEncoding,
      color: {
        ...baseEncoding.color,
        scale: {
          domain: [...SOURCES],
          range: [ACCENT, GREY, GREY, GREY, GREY, GREY],
        },
      },
    },
    legend: { show: false },
    endpointLabels: { content: "label value", format: ".1f", showLeader: true },
    seriesStyles: { Coal: { strokeWidth: 3 } },
    chrome: {
      title: `US coal fell from ${coalStart.toFixed(1)}% to ${coalEnd.toFixed(1)}% of main-source generation between ${firstYear} and ${lastYear}`,
      subtitle,
    },
  },
});
