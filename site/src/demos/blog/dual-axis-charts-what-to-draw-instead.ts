/**
 * The figures in the blog post "Dual-axis charts: what to draw instead": the
 * same NHTSA road-death series on two dual-axis charts that tell opposite
 * stories, then the two fixes (separate panels, an indexed chart) with NIFC
 * wildfire counts and NHTSA again. Titles state findings computed from the
 * dataset rows so they cannot drift from the data. The post's `json demo`
 * fences repeat `wildfirePanels.spec` and `fatalitiesIndexed.spec` verbatim,
 * and a test holds them together.
 */
import { nhtsaTrafficFatalities } from "@datasets/nhtsa-traffic-fatalities";
import { nifcWildfires } from "@datasets/nifc-wildfires";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const BLUE = "#0e7490";
const ORANGE = "#e07b39";

const traffic = nhtsaTrafficFatalities.data;
const fires = nifcWildfires.data;
const first = traffic[0];
const last = traffic[traffic.length - 1];

/** Percent change from the first to the last row, rounded to a whole percent. */
const pctChange = (from: number, to: number) => Math.round(((to - from) / from) * 100);

export const deathsFallPct = Math.abs(pctChange(first.total_fatalities, last.total_fatalities));
export const ratePct = Math.abs(pctChange(first.rate_per_100m_vmt, last.rate_per_100m_vmt));

const dated = traffic.map((row) => ({
  date: `${row.year}-01-01`,
  deaths: row.total_fatalities,
  rate: row.rate_per_100m_vmt,
}));

/** One layered chart: deaths on the left axis, the death rate on the right. */
function dualAxis(
  deathsDomain: [number, number],
  rateDomain: [number, number],
  deathsValues: number[],
  rateValues: number[],
  title: string,
) {
  const x = { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } } as const;
  return {
    chrome: {
      title,
      subtitle: `US road deaths (left axis, ${deathsDomain[0].toLocaleString("en-US")} to ${deathsDomain[1].toLocaleString("en-US")}) and deaths per 100 million vehicle miles (right axis, ${rateDomain[0]} to ${rateDomain[1]}), 1966-2024`,
    },
    resolve: { scale: { y: "independent" } },
    layer: [
      {
        mark: { type: "line", stroke: BLUE, strokeWidth: 2.5 },
        data: dated,
        encoding: {
          x,
          y: {
            field: "deaths",
            type: "quantitative",
            scale: { domain: deathsDomain, nice: false },
            axis: {
              title: "Deaths",
              format: "~s",
              labelColor: BLUE,
              values: deathsValues,
            },
          },
        },
        labels: { density: "none" },
      },
      {
        mark: { type: "line", stroke: ORANGE, strokeWidth: 2.5 },
        data: dated,
        encoding: {
          x,
          y: {
            field: "rate",
            type: "quantitative",
            scale: { domain: rateDomain, nice: false },
            axis: {
              title: "Deaths per 100M miles",
              format: ".0f",
              labelColor: ORANGE,
              values: rateValues,
            },
          },
        },
        labels: { density: "none" },
      },
    ],
  } as const;
}

export const dualAxisZeroBased = defineDemo({
  id: "blog/dual-axis-zero-based",
  title: "Road deaths and the death rate, left axis from zero",
  source: sourceOf(nhtsaTrafficFatalities),
  height: 420,
  spec: dualAxis(
    [0, 60000],
    [0, 6],
    [0, 20000, 40000, 60000],
    [0, 2, 4, 6],
    "With the left axis from zero, deaths slide slowly while the rate plunges",
  ),
});

export const dualAxisTrimmed = defineDemo({
  id: "blog/dual-axis-trimmed",
  title: "Road deaths and the death rate, both axes trimmed",
  source: sourceOf(nhtsaTrafficFatalities),
  height: 420,
  spec: dualAxis(
    [30000, 56000],
    [1, 6],
    [30000, 40000, 50000],
    [1, 2, 3, 4, 5, 6],
    "With both axes trimmed, deaths and the rate slide down as a pair",
  ),
});

// Fires per year and acres per fire, stacked in two panels that share the year axis.
const panelRows = fires.flatMap((row) => [
  { date: `${row.year}-01-01`, measure: "Fires per year", value: row.fires },
  { date: `${row.year}-01-01`, measure: "Acres burned per fire", value: row.acres_per_fire },
]);

const ratioOfSums = (from: number, to: number) => {
  const years = fires.filter((row) => row.year >= from && row.year <= to);
  const acres = years.reduce((sum, row) => sum + row.acres, 0);
  const count = years.reduce((sum, row) => sum + row.fires, 0);
  return acres / count;
};
export const acresPerFireEarly = Math.round(ratioOfSums(1985, 1994));
export const acresPerFireLate = Math.round(ratioOfSums(2015, 2024));

export const wildfirePanels = defineDemo({
  id: "blog/wildfire-two-panels",
  title: "US wildfires: count and size in two panels",
  source: sourceOf(nifcWildfires),
  height: 560,
  spec: {
    mark: { type: "line", stroke: BLUE, strokeWidth: 2 },
    data: panelRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
      y: { field: "value", type: "quantitative", axis: { format: "~s" } },
      facet: { field: "measure", type: "nominal", sort: null, columns: 1 },
    },
    resolve: { scale: { y: "independent" } },
    chrome: {
      title: `Fires per year did not climb, but the average fire grew from ${acresPerFireEarly} to ${acresPerFireLate} acres`,
      subtitle:
        "US wildland fires per year and acres burned per fire, 1983-2025. Average acres per fire: 1985-1994 against 2015-2024",
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
    mark: { type: "line", strokeWidth: 2.5 },
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
        scale: { domain: ["Deaths", "Deaths per 100M miles"], range: [BLUE, ORANGE] },
      },
    },
    chrome: {
      title: `Since 1966, deaths fell ${deathsFallPct}% and the death rate fell ${ratePct}%`,
      subtitle: "US road deaths and deaths per 100 million vehicle miles, indexed to 1966 = 100",
    },
  },
});
