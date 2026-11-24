/**
 * The figures in the blog post "When to use a bar chart race": the resident
 * population of the states that ranked in the ten most populous at any census
 * from 1910 to 2020, drawn as a top-10 race, as a bump chart of rank for the
 * seven states that ever ranked in the top five, and as a line chart of the
 * same seven states' populations (the spec the post prints in its `json demo`
 * fence). Titles state findings computed from the rows so they cannot drift.
 *
 * The rows live here because no dataset module carries them. VERIFIED
 * 2026-11-24 against the OpenData dataset `census/state-population` (default
 * view, from the Census Bureau's 2020 apportionment file) with:
 * WITH r AS (SELECT state_name, year, population, RANK() OVER (PARTITION BY year
 * ORDER BY population DESC) rk FROM data WHERE year >= 1910 AND state_name NOT
 * IN ('Puerto Rico','District of Columbia')) SELECT ... FROM r WHERE state_name
 * IN (states with rk <= 10 in any year). Ranks are among the 50 present-day
 * states; Alaska, Arizona, Hawaii and New Mexico were territories in some early
 * censuses and were too small to move any rank shown here. California, 1970:
 * 19,953,134; Texas, 2020: 29,145,505.
 */
import type { RaceSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const CENSUS_YEARS = [1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

/** Resident population and rank among the 50 states at each census in `CENSUS_YEARS`. */
const STATES: Record<string, { population: number[]; rank: number[] }> = {
  California: {
    population: [
      2377549, 3426861, 5677251, 6907387, 10586223, 15717204, 19953134, 23667902, 29760021,
      33871648, 37253956, 39538223,
    ],
    rank: [12, 8, 6, 5, 2, 2, 1, 1, 1, 1, 1, 1],
  },
  Florida: {
    population: [
      752619, 968470, 1468211, 1897414, 2771305, 4951560, 6789443, 9746324, 12937926, 15982378,
      18801310, 21538187,
    ],
    rank: [33, 32, 31, 27, 20, 10, 9, 7, 4, 4, 4, 3],
  },
  Georgia: {
    population: [
      2609121, 2895832, 2908506, 3123723, 3444578, 3943116, 4589575, 5463105, 6478216, 8186453,
      9687653, 10711908,
    ],
    rank: [10, 12, 14, 14, 13, 16, 15, 13, 11, 10, 9, 8],
  },
  Illinois: {
    population: [
      5638591, 6485280, 7630654, 7897241, 8712176, 10081158, 11113976, 11426518, 11430602, 12419293,
      12830632, 12812508,
    ],
    rank: [3, 3, 3, 3, 4, 4, 5, 5, 6, 5, 5, 6],
  },
  Indiana: {
    population: [
      2700876, 2930390, 3238503, 3427796, 3934224, 4662498, 5193669, 5490224, 5544159, 6080485,
      6483802, 6785528,
    ],
    rank: [9, 11, 11, 12, 12, 11, 11, 12, 14, 14, 15, 17],
  },
  Massachusetts: {
    population: [
      3366416, 3852356, 4249614, 4316721, 4690514, 5148578, 5689170, 5737037, 6016425, 6349097,
      6547629, 7029917,
    ],
    rank: [6, 6, 8, 8, 9, 9, 10, 11, 13, 13, 14, 15],
  },
  Michigan: {
    population: [
      2810173, 3668412, 4842325, 5256106, 6371766, 7823194, 8875083, 9262078, 9295297, 9938444,
      9883640, 10077331,
    ],
    rank: [8, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 10],
  },
  Missouri: {
    population: [
      3293335, 3404055, 3629367, 3784664, 3954653, 4319813, 4676501, 4916686, 5117073, 5595211,
      5988927, 6154913,
    ],
    rank: [7, 9, 10, 10, 11, 13, 13, 15, 15, 17, 18, 19],
  },
  "New Jersey": {
    population: [
      2537167, 3155900, 4041334, 4160165, 4835329, 6066782, 7168164, 7364823, 7730188, 8414350,
      8791894, 9288994,
    ],
    rank: [11, 10, 9, 9, 8, 8, 8, 9, 9, 9, 11, 11],
  },
  "New York": {
    population: [
      9113614, 10385227, 12588066, 13479142, 14830192, 16782304, 18236967, 17558072, 17990455,
      18976457, 19378102, 20201249,
    ],
    rank: [1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4],
  },
  "North Carolina": {
    population: [
      2206287, 2559123, 3170276, 3571623, 4061929, 4556155, 5082059, 5881766, 6628637, 8049313,
      9535483, 10439388,
    ],
    rank: [16, 14, 12, 11, 10, 12, 12, 10, 10, 11, 10, 9],
  },
  Ohio: {
    population: [
      4767121, 5759394, 6646697, 6907612, 7946627, 9706397, 10652017, 10797630, 10847115, 11353140,
      11536504, 11799448,
    ],
    rank: [4, 4, 4, 4, 5, 5, 6, 6, 7, 7, 7, 7],
  },
  Pennsylvania: {
    population: [
      7665111, 8720017, 9631350, 9900180, 10498012, 11319366, 11793909, 11863895, 11881643,
      12281054, 12702379, 13002700,
    ],
    rank: [2, 2, 2, 2, 3, 3, 3, 4, 5, 6, 6, 5],
  },
  Texas: {
    population: [
      3896542, 4663228, 5824715, 6414824, 7711194, 9579677, 11196730, 14229191, 16986510, 20851820,
      25145561, 29145505,
    ],
    rank: [5, 5, 5, 6, 6, 6, 4, 3, 3, 2, 2, 2],
  },
};

/** The rows in dataset-module shape, one per state and census. */
export const statePopulation = {
  source: "Source: US Census Bureau, decennial census resident population by state",
  url: "https://www.census.gov/data/tables/time-series/dec/popchange-data-text.html",
  data: Object.entries(STATES).flatMap(([state, { population, rank }]) =>
    CENSUS_YEARS.map((year, index) => ({
      state,
      year,
      population: population[index] as number,
      rank: rank[index] as number,
    })),
  ),
};

const source = sourceOf(statePopulation);
const rows = statePopulation.data;
const LAST = CENSUS_YEARS.at(-1) as number;
const FIRST = CENSUS_YEARS[0] as number;

const rowOf = (state: string, year: number) => {
  const row = rows.find((entry) => entry.state === state && entry.year === year);
  if (!row) throw new Error(`no census row for ${state} in ${year}`);
  return row;
};
/** 1st, 2nd, 3rd, 4th ... 33rd: the rank as prose. */
const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
};
const leaderIn = (year: number) => rows.find((row) => row.year === year && row.rank === 1)?.state;
/** The first census at which `state` has more people than `other`. */
const passes = (state: string, other: string) =>
  CENSUS_YEARS.find((year) => rowOf(state, year).population > rowOf(other, year).population);

/** The seven states that ranked in the top five at any census. */
export const TOP_FIVE_STATES = Object.keys(STATES).filter((state) =>
  rows.some((row) => row.state === state && row.rank <= 5),
);

const californiaFirst = CENSUS_YEARS.find((year) => leaderIn(year) === "California");
const texasPassesNewYork = passes("Texas", "New York");
const floridaPassesNewYork = passes("Florida", "New York");

export const stateRace = defineDemo({
  id: "blog/state-population-race",
  title: `The 10 most populous states at each census, ${FIRST}-${LAST}`,
  source,
  // The post's hero, which paints one static pair at the desktop size: no phone height.
  height: 490,
  spec: {
    type: "race",
    mark: "bar",
    data: rows.map(({ state, year, population }) => ({ state, year, population })),
    encoding: {
      time: { field: "year", type: "quantitative", format: "d" },
      key: { field: "state", type: "nominal" },
      value: { field: "population", type: "quantitative", format: ".3~s" },
    },
    chrome: {
      title: `California became the most populous state in ${californiaFirst}`,
      subtitle: `Resident population at each census, the 10 most populous states, ${FIRST}-${LAST}`,
    },
  } satisfies RaceSpec,
});

const fiveRows = rows.filter((row) => TOP_FIVE_STATES.includes(row.state));
const ACCENT = { light: "#0e7490", dark: "#22a3c4" };
const MUTED = { light: "#64748b", dark: "#94a3b8" };
/** One palette slot per state in data order: the climbers in the accent, the rest muted. */
const CLIMBERS = ["California", "Florida", "Texas"];
const stateColors = TOP_FIVE_STATES.map((state) => (CLIMBERS.includes(state) ? ACCENT : MUTED));

/**
 * Phone-width x axis for the bump chart: first, middle and last census. Beside
 * the end-label column the six desktop ticks run into each other below 400px.
 */
const phoneCensusAxis = {
  encoding: { x: { axis: { values: [String(FIRST), "1960", String(LAST)] } } },
};

export const stateBump = defineDemo({
  id: "blog/state-population-bump",
  title: `Population rank of seven states, ${FIRST}-${LAST}`,
  source,
  height: 480,
  spec: {
    mark: { type: "line", interpolate: "monotone", point: true },
    data: fiveRows.map(({ state, year, rank }) => ({ state, year: String(year), rank })),
    encoding: {
      x: {
        field: "year",
        type: "ordinal",
        axis: { labelAngle: 0, values: ["1910", "1930", "1950", "1970", "1990", "2010"] },
      },
      y: {
        field: "rank",
        type: "quantitative",
        scale: { reverse: true, zero: false, domain: [1, 33] },
        axis: { values: [1, 5, 10, 20, 33], format: "ordinal" },
      },
      color: { field: "state", type: "nominal" },
    },
    endpointLabels: { ends: "end", content: "label", showMarker: false },
    legend: { show: false },
    theme: { colors: { categorical: stateColors } },
    // Phones span compact (under 400px) and medium (400 to 700px).
    overrides: { compact: phoneCensusAxis, medium: phoneCensusAxis },
    chrome: {
      title: `Florida climbed from ${ordinal(rowOf("Florida", FIRST).rank)} to ${ordinal(rowOf("Florida", LAST).rank)} and New York fell to ${ordinal(rowOf("New York", LAST).rank)}`,
      subtitle: `Rank by population among the 50 states at each census, states that reached the top five, ${FIRST}-${LAST}`,
    },
  },
});

export const stateLines = defineDemo({
  id: "blog/state-population-lines",
  title: `Population of seven states, ${FIRST}-${LAST}`,
  source,
  height: 460,
  spec: {
    mark: "line",
    data: fiveRows.map(({ state, year, population }) => ({
      state,
      year: String(year),
      population,
    })),
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "population",
        type: "quantitative",
        axis: { title: "Residents", format: "~s", tickCount: 5 },
      },
      color: { field: "state", type: "nominal" },
    },
    endpointLabels: { ends: "end", content: "label" },
    legend: { show: false },
    theme: { colors: { categorical: stateColors } },
    chrome: {
      title: `Texas passed New York in ${texasPassesNewYork} and Florida passed it in ${floridaPassesNewYork}`,
      subtitle: `Resident population at each census, states that reached the top five, ${FIRST}-${LAST}`,
    },
  },
});
