/**
 * The figures in the blog post "How to use small multiples": space
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

// Light and dark values for each series, so lines and their end labels keep
// 4.5:1 on the page in both site themes. A plain hex renders verbatim in dark.
const TEAL = { light: "#0e7490", dark: "#22a3c4" };
const ORANGE = { light: "#c2410c", dark: "#fb923c" };
const GRAY = { light: "#6b7280", dark: "#9ca3af" };
const PURPLE = { light: "#7c3aed", dark: "#a78bfa" };

const launches = spaceLaunchesByCountry.data;
const crime = fbiViolentCrimeRates.data;

const COUNTRIES = [
  { key: "ussr_russia", label: "USSR/Russia", color: TEAL },
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
// Panels are short, so their y ticks sit in a gutter beside the plot, where no line
// can run through them.
const panelYAxis = { tickPosition: "gutter" } as const;
const line = { type: "line", strokeWidth: 2, interpolate: "linear" } as const;
// The crime rows start in 1979, so a 1980 tick would sit under the bottom panel's
// lowest y label; start the year ticks at 1990 instead, and on a phone space them
// 15 years apart so the last label has room before the right edge.
const crimeXAxis = {
  format: "%Y",
  values: ["1990-01-01", "2000-01-01", "2010-01-01", "2020-01-01"],
};
const crimeCompactX = { axis: { values: ["1990-01-01", "2005-01-01", "2020-01-01"] } };

export const launchesOneChart = defineDemo({
  id: "blog/launches-one-chart",
  title: "Space launches by country on one chart",
  source: sourceOf(spaceLaunchesByCountry),
  height: 420,
  spec: {
    mark: line,
    data: launchRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: xAxis },
      y: { field: "launches", type: "quantitative", axis: { title: "Launches per year" } },
      color: {
        field: "country",
        type: "nominal",
        scale: { domain: COUNTRIES.map((country) => country.label) },
      },
    },
    theme: { colors: { categorical: COUNTRIES.map((country) => country.color) } },
    chrome: {
      title: `USSR and Russian launches peaked at ${sovietPeak.ussr_russia} in ${sovietPeak.year}, US launches at ${usPeak.usa} in ${usPeak.year}`,
      subtitle: "Launches per year by country, 1957-2018",
    },
  },
});

export const launchPanels = defineDemo({
  id: "blog/launches-panels",
  title: "Space launches by country in four panels",
  source: sourceOf(spaceLaunchesByCountry),
  height: 780,
  spec: {
    mark: line,
    data: launchRows,
    encoding: {
      x: { field: "date", type: "temporal", axis: xAxis },
      y: { field: "launches", type: "quantitative", axis: panelYAxis },
      row: { field: "country", type: "nominal", sort: null },
    },
    resolve: { scale: { y: "shared" } },
    theme: { colors: { categorical: [TEAL] } },
    chrome: {
      title: `China launched ${last.china} times in ${last.year}, one more than the US`,
      subtitle: "Launches per year by country, 1957-2018, same y scale in each panel",
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
// The highest homicide rate since 2000 (2021), and the low the climb to it started from.
const recentHomicidePeak = crime
  .filter((row) => row.year >= 2000)
  .reduce((max, row) => (row.homicide_rate_per_100k > max.homicide_rate_per_100k ? row : max));
let climbIndex = crime.indexOf(recentHomicidePeak);
while (
  climbIndex > 0 &&
  must(crime[climbIndex - 1], "violent crime").homicide_rate_per_100k <
    must(crime[climbIndex], "violent crime").homicide_rate_per_100k
) {
  climbIndex -= 1;
}
const homicideClimbStart = must(crime[climbIndex], "violent crime");

/** Robbery's range over homicide's: how many robbery points share the height of one homicide point on free scales. */
const span = (values: number[]) => Math.max(...values) - Math.min(...values);
export const robberyPointsPerHomicidePoint = Math.round(
  span(crime.map((row) => row.robbery_rate_per_100k)) /
    span(crime.map((row) => row.homicide_rate_per_100k)),
);

const crimeSpec = (shared: boolean): VizSpec => ({
  mark: line,
  data: crimeRows,
  encoding: {
    x: { field: "date", type: "temporal", axis: crimeXAxis },
    y: { field: "rate", type: "quantitative", axis: panelYAxis },
    row: { field: "crime", type: "nominal", sort: null },
  },
  resolve: { scale: { y: shared ? "shared" : "independent" } },
  overrides: { compact: { encoding: { x: crimeCompactX } } },
  theme: { colors: { categorical: [TEAL] } },
  chrome: {
    title: shared
      ? `On a shared scale, homicide's fall from ${row1991?.homicide_rate_per_100k} to ${lastCrime.homicide_rate_per_100k} is a flat line`
      : `Homicide rose from ${homicideClimbStart.homicide_rate_per_100k.toFixed(1)} per 100,000 in ${homicideClimbStart.year} to ${recentHomicidePeak.homicide_rate_per_100k} in ${recentHomicidePeak.year}`,
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
