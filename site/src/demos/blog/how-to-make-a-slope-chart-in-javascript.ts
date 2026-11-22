/**
 * The figures in the blog post "How to make a slope chart in JavaScript":
 * fatal accidents at the airlines that had four or more in 1985-99, compared
 * with 2000-14; then Arctic sea ice extent in March and September, 1980 versus
 * 2012; then the same September series as a line, to show what two chosen
 * endpoints leave out. Titles state findings computed from the dataset rows so
 * they cannot drift from the data. The post's `json demo` fence repeats
 * `airlineSlope.spec` verbatim, and a test holds the two together.
 */
import { airlineSafety } from "@datasets/airline-safety";
import { arcticSeaIce } from "@datasets/arctic-sea-ice";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";
const MUTED = "#94a3b8";

const EARLY = "1985-99";
const LATE = "2000-14";

/** Airlines with at least this many fatal accidents in 1985-99 get a line. */
export const MIN_EARLY_ACCIDENTS = 4;

/**
 * A short label for an airline: the source's first name for a merged airline
 * ("Delta / Northwest*" becomes "Delta") and no trailing "Airlines", so the
 * label columns leave room for the lines on a phone.
 */
export const nameOf = (airline: string) =>
  (airline.split(" / ")[0] ?? airline).replace(/\*$/, "").replace(/ Airlines$/, "");

const shown = airlineSafety.data
  .filter((row) => row.fatal_accidents_85_99 >= MIN_EARLY_ACCIDENTS)
  .sort((a, b) => b.fatal_accidents_85_99 - a.fatal_accidents_85_99);
const earlyTotal = shown.reduce((sum, row) => sum + row.fatal_accidents_85_99, 0);
const lateTotal = shown.reduce((sum, row) => sum + row.fatal_accidents_00_14, 0);
const allEarly = airlineSafety.data.reduce((sum, row) => sum + row.fatal_accidents_85_99, 0);
const allLate = airlineSafety.data.reduce((sum, row) => sum + row.fatal_accidents_00_14, 0);

const periodRows = shown.flatMap((row) => [
  { airline: nameOf(row.airline), period: EARLY, accidents: row.fatal_accidents_85_99 },
  { airline: nameOf(row.airline), period: LATE, accidents: row.fatal_accidents_00_14 },
]);

/** The same rows as grouped bars, the form a slope chart is usually weighed against. */
export const airlineBars = defineDemo({
  id: "blog/airline-bars",
  title: "Fatal accidents by airline, 1985-99 and 2000-14, as grouped bars",
  source: sourceOf(airlineSafety),
  height: 640,
  spec: {
    mark: "bar",
    data: periodRows,
    encoding: {
      y: { field: "airline", type: "nominal", sort: null },
      x: {
        field: "accidents",
        type: "quantitative",
        stack: null,
        axis: { title: "Fatal accidents" },
      },
      color: {
        field: "period",
        type: "nominal",
        scale: { domain: [EARLY, LATE], range: [MUTED, ACCENT] },
      },
    },
    chrome: {
      title: `The same ${shown.length} airlines as grouped bars`,
      subtitle: `Fatal accidents per 15-year period, airlines with ${MIN_EARLY_ACCIDENTS} or more in ${EARLY}`,
    },
  },
});

export const airlineSlope = defineDemo({
  id: "blog/airline-slope",
  title: "Fatal accidents by airline, 1985-99 and 2000-14",
  source: sourceOf(airlineSafety),
  height: 520,
  spec: {
    mark: "line",
    data: periodRows,
    encoding: {
      x: { field: "period", type: "ordinal" },
      y: { field: "accidents", type: "quantitative", axis: false, scale: { zero: false } },
      color: {
        field: "airline",
        type: "nominal",
        scale: { range: [ACCENT] },
      },
    },
    endpointLabels: { ends: "both", content: { leading: "label value", trailing: "value" } },
    legend: { show: false },
    responsive: { labelSummary: true },
    chrome: {
      title: `The ${shown.length} airlines with the most fatal accidents went from ${earlyTotal} to ${lateTotal}`,
      subtitle: `Fatal accidents per 15-year period, airlines with ${MIN_EARLY_ACCIDENTS} or more in ${EARLY}. All 56 airlines: ${allEarly} to ${allLate}.`,
    },
  },
});

const ice = arcticSeaIce.data;
const iceIn = (year: number) => {
  const row = ice.find((entry) => entry.year === year);
  if (!row) throw new Error(`no sea ice row for ${year}`);
  return row;
};
const FIRST_YEAR = 1980;
const LOW_YEAR = 2012;
const first = iceIn(FIRST_YEAR);
const low = iceIn(LOW_YEAR);
const dropPercent = Math.round((1 - low.september_avg_mkm2 / first.september_avg_mkm2) * 100);

export const seaIceSlope = defineDemo({
  id: "blog/sea-ice-slope",
  title: "Arctic sea ice extent in March and September, 1980 and 2012",
  source: sourceOf(arcticSeaIce),
  height: 460,
  spec: {
    mark: "line",
    data: [
      { month: "September", year: String(FIRST_YEAR), extent: first.september_avg_mkm2 },
      { month: "September", year: String(LOW_YEAR), extent: low.september_avg_mkm2 },
      { month: "March", year: String(FIRST_YEAR), extent: first.march_avg_mkm2 },
      { month: "March", year: String(LOW_YEAR), extent: low.march_avg_mkm2 },
    ],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: { field: "extent", type: "quantitative", axis: false, scale: { zero: false } },
      color: {
        field: "month",
        type: "nominal",
        scale: { domain: ["September", "March"], range: [ACCENT, MUTED] },
      },
    },
    endpointLabels: { ends: "both", content: "label value", format: ".2f" },
    legend: { show: false },
    chrome: {
      title: `September ice fell ${dropPercent}% between ${FIRST_YEAR} and ${LOW_YEAR}; March ice barely moved`,
      subtitle: "Average Arctic sea ice extent in the month, million km²",
    },
  },
});

export const seaIceLine = defineDemo({
  id: "blog/sea-ice-line",
  title: "September Arctic sea ice extent, 1979 to 2025",
  source: sourceOf(arcticSeaIce),
  height: 420,
  spec: {
    mark: { type: "line", stroke: ACCENT, interpolate: "linear" },
    data: ice.map((row) => ({ year: String(row.year), extent: row.september_avg_mkm2 })),
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "extent",
        type: "quantitative",
        axis: { title: "Million km²", tickCount: 5 },
        scale: { domain: [0, 8], zero: true },
      },
    },
    annotations: [
      {
        type: "text",
        x: String(FIRST_YEAR),
        y: first.september_avg_mkm2,
        text: `**${FIRST_YEAR}**\n${first.september_avg_mkm2.toFixed(2)}`,
        anchor: "top",
        offset: { dx: 28, dy: -30 },
        connector: "curve",
      },
      {
        type: "text",
        x: String(LOW_YEAR),
        y: low.september_avg_mkm2,
        text: `**${LOW_YEAR}**\n${low.september_avg_mkm2.toFixed(2)}`,
        anchor: "bottom",
        offset: { dx: 0, dy: 40 },
        connector: "curve",
      },
    ],
    labels: false,
    responsive: { compactAnnotationLimit: 2 },
    chrome: {
      title: `September ice reached its record low in ${LOW_YEAR}, then partly recovered`,
      subtitle: "Average Arctic sea ice extent in September, million km², 1979-2025",
    },
  },
});
