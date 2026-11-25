/**
 * The figures in the blog post "How to make a population pyramid in JavaScript":
 * Japan's population by five-year age group and sex from the UN World Population
 * Prospects 2024, first as a static mirrored-bar pyramid for 2020 (the post's
 * lead and the spec it prints in its `json demo` fence), then as a playing
 * pyramid over every fifth year from 1950 to 2100. Titles state findings
 * computed from the rows so they cannot drift from the data. A test holds the
 * fence to `japanPyramid2020.spec`.
 */
import { JAPAN_AGE_GROUPS, japanPopulation } from "@datasets/japan-population";
import type { BarEncoding, ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const source = sourceOf(japanPopulation);
const rows = japanPopulation.data;

/** The year the static pyramid draws: the last census year, and an estimate rather than a projection. */
export const STATIC_YEAR = 2020;
/** The UN's figures from this year on are projections. */
export const FIRST_PROJECTED_YEAR = 2025;

const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
const FIRST_YEAR = years[0] as number;
const LAST_YEAR = years.at(-1) as number;

/** Both sexes in one age group in a year. */
export function peopleIn(year: number, age: string): number {
  return rows
    .filter((row) => row.year === year && row.age === age)
    .reduce((sum, row) => sum + row.pop, 0);
}

/** The age group with the most people in a year. */
export function largestGroup(year: number): string {
  const [largest] = [...JAPAN_AGE_GROUPS].sort((a, b) => peopleIn(year, b) - peopleIn(year, a));
  if (largest === undefined) throw new Error("the Japan population rows have no age groups");
  return largest;
}

const encoding: BarEncoding = {
  y: { field: "age", type: "ordinal", sort: JAPAN_AGE_GROUPS },
  x: { field: "pop", type: "quantitative", format: ".2~s" },
  color: { field: "sex", type: "nominal", sort: ["Male", "Female"] },
};

const staticPyramid: ChartSpec = {
  mark: { type: "bar", mirror: true },
  data: rows.filter((row) => row.year === STATIC_YEAR),
  encoding,
  chrome: {
    title: `Japan's largest age group in ${STATIC_YEAR} was ${largestGroup(STATIC_YEAR)}`,
    subtitle: `Population by five-year age group and sex, ${STATIC_YEAR}`,
  },
};

export const japanPyramid2020 = defineDemo({
  id: "blog/japan-pyramid-2020",
  title: `Japan's population by age and sex, ${STATIC_YEAR}`,
  source,
  height: 560,
  spec: staticPyramid,
});

const playingPyramid: ChartSpec = {
  mark: { type: "bar", mirror: true },
  data: rows,
  encoding: { ...encoding, time: { field: "year", type: "temporal" } },
  playback: { duration: 15000 },
  chrome: {
    title: `Japan's largest age group moves from ${largestGroup(FIRST_YEAR)} in ${FIRST_YEAR} to ${largestGroup(LAST_YEAR)} in ${LAST_YEAR}`,
    subtitle: `Population by age and sex, ${FIRST_YEAR}-${LAST_YEAR}; ${FIRST_PROJECTED_YEAR} onward is the UN's projection`,
  },
};

export const japanPyramidPlayback = defineDemo({
  id: "blog/japan-pyramid-playback",
  title: `Japan's population by age and sex, ${FIRST_YEAR}-${LAST_YEAR}, playing`,
  source,
  height: 600,
  spec: playingPyramid,
});
