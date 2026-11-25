/**
 * The figures in the blog post "How to make an animated choropleth map": the
 * Department of Labor's insured unemployment rate for the 50 states and DC
 * through 2020, as a playing states choropleth over every other week (the
 * post's lead, shown again in the body), then as a playing tile map over every
 * fourth week (the spec the post prints in its `json demo` fence). The weeks are
 * thinned to keep the page under the site's 500 KB cap and the fence readable;
 * playback interpolates between the weeks kept. Titles state findings computed from the rows so they cannot
 * drift from the data. A test holds the fence to `insuredTileMap.spec`.
 */
import {
  type InsuredUnemploymentRow,
  insuredUnemployment2020,
} from "@datasets/insured-unemployment-2020";
import type { GeoMapSpec, TileMapSpec } from "@opendata-ai/openchart-core";
import { usStates } from "../maps/geography";
import { sourceWithGeography } from "../maps/sources";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const rows: InsuredUnemploymentRow[] = insuredUnemployment2020.data;

/** Every week in the dataset, oldest first. */
export const WEEKS = [...new Set(rows.map((row) => row.week))].sort();

/** Every `stride`th week, counted back from the last so December 26 stays in. */
const everyNthWeek = (stride: number) =>
  WEEKS.filter((_, index) => (WEEKS.length - 1 - index) % stride === 0);

/** The choropleth's weeks: every other week, which keeps March 21 and June 27. */
export const CHOROPLETH_WEEKS = everyNthWeek(2);
/** The tile map's weeks: every fourth week, short enough to print in a code block. */
export const TILE_WEEKS = everyNthWeek(4);

/** The rate in the middle state (26th of 51) in a week. */
export function medianRate(week: string): number {
  const rates = rows
    .filter((row) => row.week === week && row.rate !== null)
    .map((row) => row.rate as number)
    .sort((a, b) => a - b);
  const middle = rates[Math.floor(rates.length / 2)];
  if (middle === undefined) throw new Error(`no insured unemployment rates in the week of ${week}`);
  return middle;
}

const rateIn = (code: string, week: string) =>
  rows.find((row) => row.code === code && row.week === week)?.rate ?? null;

/** The tile map title compares its own first and last weeks. */
const FIRST_WEEK = TILE_WEEKS[0] as string;
const LAST_WEEK = WEEKS.at(-1) as string;
const peakWeek = CHOROPLETH_WEEKS.reduce((peak, week) =>
  medianRate(week) > medianRate(peak) ? week : peak,
);
const dayLabel = (week: string) =>
  new Date(`${week}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** The states whose rate in the last week of 2020 is above their rate in the tile map's first week. */
export const statesHigherAtYearEnd = [...new Set(rows.map((row) => row.code))].filter(
  (code) => (rateIn(code, LAST_WEEK) ?? 0) > (rateIn(code, FIRST_WEEK) ?? Infinity),
);

const RATE = {
  field: "rate",
  type: "quantitative",
  title: "Insured unemployment rate (%)",
  format: ".1f",
} as const;
const WEEK = { field: "week", type: "temporal" } as const;
const subtitle = "Insured unemployment rate by state, 2020";

const choroplethSpec: GeoMapSpec = {
  type: "map",
  geo: { features: usStates, projection: "albersUsa", idField: "name" },
  data: rows
    .filter((row) => CHOROPLETH_WEEKS.includes(row.week))
    .map(({ state, week, rate }) => ({ state, week, rate })),
  encoding: {
    key: { field: "state", type: "nominal" },
    color: RATE,
    time: WEEK,
  },
  playback: { duration: 20000, period: { format: "%b %-d" } },
  chrome: {
    title: `In the median state, insured unemployment rose from ${medianRate(CHOROPLETH_WEEKS[0] as string).toFixed(1)}% to ${medianRate(peakWeek).toFixed(1)}% by ${dayLabel(peakWeek)}`,
    subtitle: `${subtitle}, every other week`,
  },
};

/** The lead: every other week of 2020 on the states. */
export const insuredChoropleth = defineDemo({
  id: "blog/insured-unemployment-choropleth",
  title: "Insured unemployment rate by state through 2020 on a playing choropleth",
  source: sourceWithGeography(insuredUnemployment2020, "us"),
  height: 520,
  spec: choroplethSpec,
});

const tileMapSpec: TileMapSpec = {
  type: "tilemap",
  data: rows
    .filter((row) => TILE_WEEKS.includes(row.week))
    .map(({ code, week, rate }) => ({ code, week, rate })),
  encoding: {
    state: { field: "code", type: "nominal" },
    value: RATE,
    time: WEEK,
  },
  playback: { duration: 12000 },
  chrome: {
    title: `${statesHigherAtYearEnd.length === 51 ? "Every state" : `${statesHigherAtYearEnd.length} states`} ended 2020 with a higher rate than it started with`,
    subtitle: `${subtitle}, every fourth week`,
  },
};

/** The fenced spec: the same rates on the tile grid, every fourth week. */
export const insuredTileMap = defineDemo({
  id: "blog/insured-unemployment-tilemap",
  title: "Insured unemployment rate by state through 2020 on a playing tile map",
  source: sourceOf(insuredUnemployment2020),
  height: 560,
  spec: tileMapSpec,
});
