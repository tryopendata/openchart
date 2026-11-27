/**
 * The chart the publish section sets in an article and exports, and its source.
 * Data: the electricity-mix-matrix dataset the hero already ships, narrowed to
 * coal against wind and solar combined, so the section adds no data weight.
 *
 * The screen reader panel prints the library's alt text and data table as they
 * come, so the rows are shaped for that: plain field names (year, share,
 * source) and the year as "2016", which the temporal axis reads as Jan 1 and
 * draws exactly as it draws "2016-01-01".
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../../../demos/source";
import type { DemoSource } from "../../../demos/types";

/** One row of the published chart: a source's share of US generation in one year. */
type ShareRow = { year: string; share: number; source: string };

const COAL = "Coal";
const RENEWABLES = "Wind and solar";

/** The share of `sourceName` in `year`, from the dataset. */
function shareOf(year: string, sourceName: string): number {
  const row = electricityMixMatrix.data.find(
    (entry) => entry.year === year && entry.source === sourceName,
  );
  if (row?.share === undefined) {
    throw new Error(`electricity-mix-matrix has no ${sourceName} share for ${year}.`);
  }
  return row.share;
}

/** Coal and wind plus solar for every year in the dataset, shares rounded to one decimal. */
function coalAgainstRenewables(): ShareRow[] {
  const years = [...new Set(electricityMixMatrix.data.map((row) => row.year))];
  return years.flatMap((year) => {
    // Summing two one-decimal shares leaves float noise (10.4 + 4.9), so round it back.
    const renewables = Math.round((shareOf(year, "Wind") + shareOf(year, "Solar")) * 10) / 10;
    return [
      { year, share: shareOf(year, COAL), source: COAL },
      { year, share: renewables, source: RENEWABLES },
    ];
  });
}

/** The published chart: coal's share of US generation falling to meet wind and solar's. */
export const publishSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2 },
  data: coalAgainstRenewables(),
  encoding: {
    x: { field: "year", type: "temporal" },
    y: {
      field: "share",
      type: "quantitative",
      axis: { title: "Share of generation (%)", format: ".0f", grid: true },
    },
    color: { field: "source", type: "nominal" },
  },
  annotations: [
    {
      type: "text",
      x: "2021",
      y: 22.2,
      text: "Coal rose in 2021\nas gas prices climbed",
      anchor: "top",
      offset: { dx: 44, dy: -30 },
      connector: true,
      // Keeps the callout on the line on a phone: a note band would grow the chart past its fixed box.
      responsive: false,
    },
  ],
  endpointLabels: { format: ".1f" },
  chrome: {
    title: "Wind and solar nearly caught coal in US power",
    // The article names the six sources; a full list wrapped the subtitle at article width.
    subtitle: "Coal and wind plus solar, share of generation from the six main sources (%)",
  },
};

/** The published chart's source line. */
export const publishSource: DemoSource = sourceOf(electricityMixMatrix);
