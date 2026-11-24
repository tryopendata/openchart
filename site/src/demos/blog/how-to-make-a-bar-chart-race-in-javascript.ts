/**
 * The figures in the blog post "How to make a bar chart race in JavaScript":
 * the World Bank's GDP for 20 large economies, 1980-2024, as a top-10 bar race,
 * then a top-5 race over only the economies that ever reach the top five (the
 * spec the post prints in its `json demo` fence), then the top-10 race as lines
 * and as a ranked table. Titles state findings computed from the rows so they
 * cannot drift from the data. A test holds the fence to `gdpTopFiveRace.spec`.
 */
import { worldGdpRace, worldGdpRaceSource } from "@datasets/world-gdp-race";
import type { RaceSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const source = sourceOf({ source: worldGdpRaceSource });

/** The dataset holds GDP in billions of current US dollars; the races draw dollars so `$.3~s` prints "$28.8T". */
const dollarRows = worldGdpRace.map(({ country, year, gdp }) => ({
  country,
  year,
  gdp: gdp * 1e9,
}));

const years = [...new Set(worldGdpRace.map((row) => row.year))].sort((a, b) => a - b);
const FIRST_YEAR = years[0];
const LAST_YEAR = years.at(-1);

/** The `n` largest economies in a year, largest first. */
export const topIn = (year: number, n: number) =>
  worldGdpRace
    .filter((row) => row.year === year)
    .sort((a, b) => b.gdp - a.gdp)
    .slice(0, n)
    .map((row) => row.country);

/** Every economy that ranks in the top `n` in at least one year: the only keys a top-`n` race can draw. */
export const everInTop = (n: number) => new Set(years.flatMap((year) => topIn(year, n)));

const gdpOf = (country: string, year: number) => {
  const row = worldGdpRace.find((entry) => entry.country === country && entry.year === year);
  if (!row) throw new Error(`no GDP row for ${country} in ${year}`);
  return row.gdp;
};

/** The first year China's GDP is above Japan's. */
const chinaPassesJapan = years.find((year) => gdpOf("China", year) > gdpOf("Japan", year));
if (chinaPassesJapan === undefined) throw new Error("China never passes Japan in the GDP rows");

const encoding: RaceSpec["encoding"] = {
  time: { field: "year", type: "quantitative", format: "d" },
  key: { field: "country", type: "nominal" },
  value: { field: "gdp", type: "quantitative", format: "$.3~s" },
};

const topTen: RaceSpec = {
  type: "race",
  mark: "bar",
  data: dollarRows,
  encoding,
  chrome: {
    title: `China passed Japan in ${chinaPassesJapan} to become the second-largest economy`,
    subtitle: `GDP in current US dollars, the 10 largest of 20 economies, ${FIRST_YEAR}-${LAST_YEAR}`,
  },
};

// The lead race is the post's hero, which paints one static pair at the desktop
// size, so only the figures below it take a taller phone stage.
const figure = { source, height: 490 };
const phoneFigure = { ...figure, phoneHeight: 530 };

export const gdpRace = defineDemo({
  ...figure,
  id: "blog/gdp-race",
  title: `The 10 largest economies, ${FIRST_YEAR}-${LAST_YEAR}`,
  spec: topTen,
});

const FIVE = 5;
const fiveKeys = everInTop(FIVE);

export const gdpTopFiveRace = defineDemo({
  ...phoneFigure,
  id: "blog/gdp-race-top-five",
  title: `The five largest economies, ${FIRST_YEAR}-${LAST_YEAR}`,
  height: 400,
  phoneHeight: 440,
  spec: {
    type: "race",
    mark: "bar",
    data: dollarRows.filter((row) => fiveKeys.has(row.country)),
    encoding,
    race: { top: FIVE, duration: 20000 },
    chrome: {
      title: `Only ${fiveKeys.size} economies have been in the top five since ${FIRST_YEAR}`,
      subtitle: `GDP in current US dollars, ${FIRST_YEAR}-${LAST_YEAR}`,
    },
  },
});

export const gdpRaceLine = defineDemo({
  ...phoneFigure,
  id: "blog/gdp-race-line",
  title: `The 10 largest economies as a line race, ${FIRST_YEAR}-${LAST_YEAR}`,
  spec: { ...topTen, mark: "line" },
});

export const gdpRaceTable = defineDemo({
  ...phoneFigure,
  id: "blog/gdp-race-table",
  title: `The 10 largest economies as a table race, ${FIRST_YEAR}-${LAST_YEAR}`,
  spec: { ...topTen, mark: { type: "table", columns: ["rank", "change", "name", "value"] } },
});
