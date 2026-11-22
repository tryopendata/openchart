/**
 * The figures in the blog post "Small multiples without the mess": space
 * launches by country as one four-line chart and then as four panels, and US
 * violent crime rates in panels on a shared and on independent y scales. Titles
 * state findings computed from the dataset rows so they cannot drift from the
 * data. The post's `json demo` fences repeat `launchPanels.spec` and
 * `crimeIndependent.spec` verbatim, and a test holds them together.
 */
import { fbiViolentCrimeRates } from "@datasets/fbi-violent-crime-rates";
import { spaceLaunchesByCountry } from "@datasets/space-launches-by-country";
import type { VizSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The row at the given index of a dataset the demo cannot be built without. */
function must<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new Error(`The ${what} dataset has no such row.`);
  return row;
}

const BLUE = "#0e7490";
const ORANGE = "#e07b39";
const GRAY = "#6b7280";
const PURPLE = "#7c3aed";

const launches = spaceLaunchesByCountry.data;
const crime = fbiViolentCrimeRates.data;

const COUNTRIES = [
  { key: "ussr_russia", label: "USSR/Russia", color: BLUE },
  { key: "usa", label: "United States", color: ORANGE },
  { key: "other", label: "Other countries", color: GRAY },
  { key: "china", label: "China", color: PURPLE },
] as const; // ordered by total launches 1957-2018, the order the panels use

const launchRows = launches.flatMap((row) =>
  COUNTRIES.map((country) => ({
    date: `${row.year}-01-01`,
    country: country.label,
    launches: row[country.key],
  })),
);

const peakOf = (key: "ussr_russia" | "usa") =>
  launches.reduce((max, row) => (row[key] > max[key] ? row : max));
const sovietPeak = peakOf("ussr_russia");
const usPeak = peakOf("usa");
const last = must(launches[launches.length - 1], "space launches");

const xAxis = { format: "%Y", tickCount: 5 } as const;
// Panels are narrow, so they take fewer x ticks to keep neighbouring labels apart.
const panelXAxis = { format: "%Y", tickCount: 3 } as const;

export const launchesOneChart = defineDemo({
  id: "blog/launches-one-chart",
  title: "Space launches by country on one chart",
  source: sourceOf(spaceLaunchesByCountry),
  height: 420,
  spec: {
    mark: { type: "line", strokeWidth: 2 },
    data: launchRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: xAxis },
      y: { field: "launches", type: "quantitative", axis: { title: "Launches per year" } },
      color: {
        field: "country",
        type: "nominal",
        scale: {
          domain: COUNTRIES.map((country) => country.label),
          range: COUNTRIES.map((country) => country.color),
        },
      },
    },
    chrome: {
      title: `USSR and Russian launches peaked at ${sovietPeak.ussr_russia} in ${sovietPeak.year}, US launches at ${usPeak.usa} in ${usPeak.year}`,
      subtitle: "Launches per year by country, 1957-2018, all four on one axis",
    },
  },
});

export const launchPanels = defineDemo({
  id: "blog/launches-panels",
  title: "Space launches by country in four panels",
  source: sourceOf(spaceLaunchesByCountry),
  height: 780,
  spec: {
    mark: { type: "line", stroke: BLUE, strokeWidth: 2 },
    data: launchRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: panelXAxis },
      y: { field: "launches", type: "quantitative" },
      facet: { field: "country", type: "nominal", sort: null, columns: 1 },
    },
    chrome: {
      title: `China launched ${last.china} times in ${last.year}, one more than the US`,
      subtitle: "Launches per year by country, 1957-2018, on the same y scale in every panel",
    },
  },
});

const CRIMES = [
  { key: "violent_crime_rate_per_100k", label: "All violent crime" },
  { key: "aggravated_assault_rate_per_100k", label: "Aggravated assault" },
  { key: "robbery_rate_per_100k", label: "Robbery" },
  { key: "homicide_rate_per_100k", label: "Homicide" },
] as const;

const crimeRows = crime.flatMap((row) =>
  CRIMES.map((c) => ({ date: `${row.year}-01-01`, crime: c.label, rate: row[c.key] })),
);

const row1991 = crime.find((row) => row.year === 1991);
const lastCrime = must(crime[crime.length - 1], "violent crime");
// The highest homicide rate since 2000, which is the 2021 bump.
const recentHomicidePeak = crime
  .filter((row) => row.year >= 2000)
  .reduce((max, row) => (row.homicide_rate_per_100k > max.homicide_rate_per_100k ? row : max));

const crimeSpec = (shared: boolean): VizSpec => ({
  mark: { type: "line", stroke: BLUE, strokeWidth: 2 },
  data: crimeRows,
  encoding: {
    x: { field: "date", type: "temporal", axis: panelXAxis },
    y: { field: "rate", type: "quantitative" },
    facet: { field: "crime", type: "nominal", sort: null, columns: 1 },
  },
  ...(shared ? {} : { resolve: { scale: { y: "independent" } } }),
  chrome: {
    title: shared
      ? `On a shared scale, homicide's fall from ${row1991?.homicide_rate_per_100k} to ${lastCrime.homicide_rate_per_100k} is a flat line`
      : `On free scales, the ${recentHomicidePeak.year} homicide rise to ${recentHomicidePeak.homicide_rate_per_100k} is visible`,
    subtitle: `US violent crime rates per 100,000 residents, 1979-2025, ${shared ? "same" : "separate"} y scale in each panel`,
  },
});

export const crimeShared = defineDemo({
  id: "blog/crime-shared",
  title: "US violent crime rates in panels, shared scale",
  source: sourceOf(fbiViolentCrimeRates),
  height: 780,
  spec: crimeSpec(true),
});

export const crimeIndependent = defineDemo({
  id: "blog/crime-independent",
  title: "US violent crime rates in panels, independent scales",
  source: sourceOf(fbiViolentCrimeRates),
  height: 780,
  spec: crimeSpec(false),
});
