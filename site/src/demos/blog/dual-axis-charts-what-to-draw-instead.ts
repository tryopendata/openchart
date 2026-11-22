/**
 * The figures in the blog post "Dual-axis charts: what to draw instead": the
 * same NHTSA road-death series on two dual-axis charts, one with both axes from
 * zero and one trimmed so both lines reach the floor in 2011, then the two fixes (separate panels, an indexed chart) with NIFC
 * wildfire counts and NHTSA again. Titles state findings computed from the
 * dataset rows so they cannot drift from the data. The post's `json demo`
 * fences repeat `wildfirePanels.spec` and `fatalitiesIndexed.spec` verbatim,
 * and a test holds them together.
 */
import { nhtsaTrafficFatalities } from "@datasets/nhtsa-traffic-fatalities";
import { nifcWildfires } from "@datasets/nifc-wildfires";
import type { VizSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The row at the given index of a dataset the demo cannot be built without. */
function must<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new Error(`The ${what} dataset has no such row.`);
  return row;
}

// Light and dark values for each series, so line, label and legend text keep
// 4.5:1 on the page in both site themes. A plain hex renders verbatim in dark.
const TEAL = { light: "#0e7490", dark: "#22a3c4" };
const ORANGE = { light: "#c2410c", dark: "#fb923c" };
// Gray for the decade-average segments, whose legend names must read as text.
const MUTED = { light: "#6b6b66", dark: "#a3a39c" };
const seriesColors = (...colors: { light: string; dark: string }[]) => ({
  colors: { categorical: colors },
});

const traffic = nhtsaTrafficFatalities.data;
const fires = nifcWildfires.data;
const first = must(traffic[0], "road-death");
const last = must(traffic[traffic.length - 1], "road-death");

/** Percent change from the first to the last row, rounded to a whole percent. */
const pctChange = (from: number, to: number) => Math.round(((to - from) / from) * 100);

export const deathsFallPct = Math.abs(pctChange(first.total_fatalities, last.total_fatalities));
export const ratePct = Math.abs(pctChange(first.rate_per_100m_vmt, last.rate_per_100m_vmt));

// The year deaths bottom out. On the trimmed chart both lines reach the floor there,
// though the two had fallen by very different amounts.
const low = traffic.reduce((min, row) => (row.total_fatalities < min.total_fatalities ? row : min));
export const lowYear = low.year;
export const deathsToLowPct = Math.abs(pctChange(first.total_fatalities, low.total_fatalities));
export const rateToLowPct = Math.abs(pctChange(first.rate_per_100m_vmt, low.rate_per_100m_vmt));

const deathRows = traffic.map((row) => ({
  date: `${row.year}-01-01`,
  series: "Deaths",
  deaths: row.total_fatalities,
}));
const rateRows = traffic.map((row) => ({
  date: `${row.year}-01-01`,
  series: "Deaths per 100M miles",
  rate: row.rate_per_100m_vmt,
}));

const ZERO_DEATHS: [number, number] = [0, 60000];
const ZERO_RATE: [number, number] = [0, 6];
const TRIM_DEATHS: [number, number] = [30000, 56000];
const TRIM_RATE: [number, number] = [1, 6];

/** One layered chart: deaths on the left axis, the death rate on the right. */
function dualAxis(
  deathsDomain: [number, number],
  rateDomain: [number, number],
  deathsValues: number[],
  rateValues: number[],
  title: string,
): VizSpec {
  const x = { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } } as const;
  const color = { field: "series", type: "nominal" } as const;
  return {
    chrome: {
      title,
      subtitle: `US road deaths (left axis, ${deathsDomain[0].toLocaleString("en-US")} to ${deathsDomain[1].toLocaleString("en-US")}) and deaths per 100 million vehicle miles (right axis, ${rateDomain[0]} to ${rateDomain[1]}), 1966-2024`,
    },
    resolve: { scale: { y: "independent" } },
    layer: [
      {
        mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
        data: deathRows,
        encoding: {
          x,
          y: {
            field: "deaths",
            type: "quantitative",
            scale: { domain: deathsDomain, nice: false },
            axis: { title: "Deaths", format: "~s", values: deathsValues },
          },
          color,
        },
        theme: seriesColors(TEAL),
        labels: { density: "none" },
      },
      {
        mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
        data: rateRows,
        encoding: {
          x,
          y: {
            field: "rate",
            type: "quantitative",
            scale: { domain: rateDomain, nice: false },
            axis: { title: "Deaths per 100M miles", format: ".0f", values: rateValues },
          },
          color,
        },
        theme: seriesColors(ORANGE),
        labels: { density: "none" },
      },
    ],
  };
}

export const dualAxisZeroBased = defineDemo({
  id: "blog/dual-axis-zero-based",
  title: "Road deaths and the death rate, both axes from zero",
  source: sourceOf(nhtsaTrafficFatalities),
  height: 420,
  spec: dualAxis(
    ZERO_DEATHS,
    ZERO_RATE,
    [0, 20000, 40000, 60000],
    [0, 2, 4, 6],
    `With both axes from zero, deaths fall ${deathsFallPct}% and the rate falls ${ratePct}%, in proportion`,
  ),
});

export const dualAxisTrimmed = defineDemo({
  id: "blog/dual-axis-trimmed",
  title: "Road deaths and the death rate, both axes trimmed",
  source: sourceOf(nhtsaTrafficFatalities),
  height: 420,
  spec: dualAxis(
    TRIM_DEATHS,
    TRIM_RATE,
    [30000, 40000, 50000],
    [1, 2, 3, 4, 5, 6],
    `With both axes trimmed, deaths seem to fall as far as the rate until ${lowYear}`,
  ),
});

// Fires per year and acres per fire, stacked in two panels that share the year axis.
// The panels start in 1985: the 1983 and 1984 counts are a fraction of every later year.
const FIRST_PANEL_YEAR = 1985;
const ratioOfSums = (from: number, to: number) => {
  const years = fires.filter((row) => row.year >= from && row.year <= to);
  const acres = years.reduce((sum, row) => sum + row.acres, 0);
  const count = years.reduce((sum, row) => sum + row.fires, 0);
  return acres / count;
};
export const acresPerFireEarly = Math.round(ratioOfSums(1985, 1994));
export const acresPerFireLate = Math.round(ratioOfSums(2015, 2024));
const lastFireYear = must(fires[fires.length - 1], "wildfire").year;

const yearly = fires.filter((row) => row.year >= FIRST_PANEL_YEAR);
/** A flat segment at a period's average, drawn as its own series in the acres panel. */
const averageSegment = (from: number, to: number, value: number) =>
  [from, to].map((year) => ({
    date: `${year}-01-01`,
    measure: "Acres burned per fire",
    series: `${from}-${String(to).slice(2)} average: ${value}`,
    value,
  }));
const panelRows = [
  ...yearly.flatMap((row) => [
    { date: `${row.year}-01-01`, measure: "Fires per year", series: "Yearly", value: row.fires },
    {
      date: `${row.year}-01-01`,
      measure: "Acres burned per fire",
      series: "Yearly",
      value: row.acres_per_fire,
    },
  ]),
  ...averageSegment(1985, 1994, acresPerFireEarly),
  ...averageSegment(2015, 2024, acresPerFireLate),
];

export const wildfirePanels = defineDemo({
  id: "blog/wildfire-two-panels",
  title: "US wildfires: count and size in two panels",
  source: sourceOf(nifcWildfires),
  height: 560,
  spec: {
    mark: { type: "line", strokeWidth: 2, interpolate: "linear" },
    data: panelRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
      y: { field: "value", type: "quantitative", axis: { format: "~s", tickPosition: "gutter" } },
      row: { field: "measure", type: "nominal", sort: null },
      color: { field: "series", type: "nominal" },
    },
    theme: seriesColors(TEAL, MUTED, MUTED),
    chrome: {
      title: `Fires per year did not climb, but the average fire grew from ${acresPerFireEarly} to ${acresPerFireLate} acres`,
      subtitle: `US wildland fires per year and acres burned per fire, ${FIRST_PANEL_YEAR}-${lastFireYear}, each panel on its own scale`,
    },
  },
});

// Both series indexed to 1966 = 100 so one axis serves both.
const indexRows = traffic.flatMap((row) => [
  {
    date: `${row.year}-01-01`,
    series: "Deaths",
    index: Number(((row.total_fatalities / first.total_fatalities) * 100).toFixed(1)),
  },
  {
    date: `${row.year}-01-01`,
    series: "Deaths per 100M miles",
    index: Number(((row.rate_per_100m_vmt / first.rate_per_100m_vmt) * 100).toFixed(1)),
  },
]);

export const fatalitiesIndexed = defineDemo({
  id: "blog/fatalities-indexed",
  title: "Road deaths and the death rate, indexed to 1966",
  source: sourceOf(nhtsaTrafficFatalities),
  height: 420,
  spec: {
    mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
    data: indexRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
      y: {
        field: "index",
        type: "quantitative",
        scale: { domain: [0, 120] },
        axis: { title: "1966 = 100", values: [0, 25, 50, 75, 100] },
      },
      color: {
        field: "series",
        type: "nominal",
        scale: { domain: ["Deaths", "Deaths per 100M miles"] },
      },
    },
    theme: seriesColors(TEAL, ORANGE),
    chrome: {
      title: `Since 1966, deaths fell ${deathsFallPct}% and the death rate fell ${ratePct}%`,
      subtitle: "US road deaths and deaths per 100 million vehicle miles, indexed to 1966 = 100",
    },
  },
});
