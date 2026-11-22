/**
 * The figures in the blog post "How to make a slope chart in JavaScript":
 * fatal accidents at the airlines that had four or more in 1985-99, compared
 * with 2000-14, as a slope chart and then as grouped bars; then Arctic sea ice
 * extent in March and September for the Septembers with the most and the least
 * ice (1980 and 2012); then the September series as a line, to show what two
 * chosen endpoints leave out. Titles state findings computed from the dataset rows so
 * they cannot drift from the data. The post's `json demo` fence repeats
 * `airlineSlope.spec` verbatim, and a test holds the two together.
 */
import { airlineSafety } from "@datasets/airline-safety";
import { arcticSeaIce } from "@datasets/arctic-sea-ice";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/**
 * Text-bearing colors as light and dark pairs: the light teal is 3.6:1 on the
 * dark page, so the dark page gets a lighter teal and a lighter grey. The grey
 * pair keeps 4.5:1 for value labels on both pages.
 */
const ACCENT = { light: "#0e7490", dark: "#22a3c4" };
const MUTED = { light: "#64748b", dark: "#94a3b8" };

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
        scale: { domain: [EARLY, LATE] },
      },
    },
    theme: { colors: { categorical: [MUTED, ACCENT] } },
    chrome: {
      title: `Fatal accidents at ${shown.length} airlines fell from ${earlyTotal} to ${lateTotal}`,
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
      y: { field: "accidents", type: "quantitative", axis: false },
      color: { field: "airline", type: "nominal" },
    },
    endpointLabels: {
      ends: "both",
      content: "label value",
      maxSeries: shown.length,
    },
    // Both label columns take the width of the wider one, which leaves a phone
    // too little room for the lines. On a phone the left column goes: a y axis
    // gives the first-period counts and the right edge keeps each name.
    overrides: {
      compact: {
        encoding: { y: { axis: { tickCount: 4 } } },
        endpointLabels: { ends: "end", content: "label value", maxSeries: shown.length },
      },
    },
    legend: { show: false },
    // One palette slot per airline, all the same color: the finding is about the group.
    theme: { colors: { categorical: shown.map(() => ACCENT) } },
    chrome: {
      title: `Fatal accidents at ${shown.length} airlines fell from ${earlyTotal} to ${lateTotal}`,
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
/** The Septembers with the most and the least ice in the record: the steepest pair the data allows. */
const most = ice.reduce((best, row) =>
  row.september_avg_mkm2 > best.september_avg_mkm2 ? row : best,
);
const least = ice.reduce((best, row) =>
  row.september_avg_mkm2 < best.september_avg_mkm2 ? row : best,
);
const FIRST_YEAR = most.year;
const LOW_YEAR = least.year;
const first = iceIn(FIRST_YEAR);
const low = iceIn(LOW_YEAR);
/** True when no September after the record low came back down to it. */
const lowHeld = ice
  .filter((row) => row.year > LOW_YEAR)
  .every((row) => row.september_avg_mkm2 > low.september_avg_mkm2);
const dropPercent = Math.round((1 - low.september_avg_mkm2 / first.september_avg_mkm2) * 100);

export const seaIceSlope = defineDemo({
  id: "blog/sea-ice-slope",
  title: `Arctic sea ice extent in March and September, ${FIRST_YEAR} and ${LOW_YEAR}`,
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
        scale: { domain: ["September", "March"] },
      },
    },
    endpointLabels: {
      ends: "both",
      content: "label value",
      format: ".2f",
    },
    overrides: {
      compact: {
        encoding: { y: { axis: { tickCount: 4 } } },
        endpointLabels: { ends: "end", content: "label value", format: ".2f" },
      },
    },
    legend: { show: false },
    theme: { colors: { categorical: [ACCENT, MUTED] } },
    chrome: {
      title: `September ice fell ${dropPercent}% from ${FIRST_YEAR} to ${LOW_YEAR}, and March ice changed little`,
      subtitle: "Average Arctic sea ice extent in March and September, million km²",
    },
  },
});

export const seaIceLine = defineDemo({
  id: "blog/sea-ice-line",
  title: "September Arctic sea ice extent, 1979 to 2025",
  source: sourceOf(arcticSeaIce),
  height: 420,
  spec: {
    mark: { type: "line", interpolate: "linear" },
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
    theme: { colors: { categorical: [ACCENT] } },
    chrome: {
      title: lowHeld
        ? `September ice reached its record low in ${LOW_YEAR} and has stayed above it since`
        : `September ice reached a record low in ${LOW_YEAR}`,
      subtitle: "Average Arctic sea ice extent in September, million km², 1979-2025",
    },
  },
});
