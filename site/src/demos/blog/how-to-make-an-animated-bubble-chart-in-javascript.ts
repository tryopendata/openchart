/**
 * The figures in the blog post "How to make an animated bubble chart in JavaScript":
 * the World Bank's GDP per capita, life expectancy and population for 62 countries,
 * 1960-2023, as a Gapminder-style bubble playback (the lead), the same encoding over the
 * 10 most populous countries every five years (the spec the post prints in its
 * `json demo` fence), and the full chart with trails on three countries. The other post
 * on animated charts reuses the encoding and the lead. A test holds the fence to
 * `populousPlayback.spec`.
 */
import { type WealthHealthHistoryRow, wealthHealthHistory } from "@datasets/wealth-health-history";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const wealthHealthSource = sourceOf(wealthHealthHistory);

/** One row per country per year; GDP, life expectancy or population is null where the World Bank has no value. */
export const wealthHealthRows: WealthHealthHistoryRow[] = wealthHealthHistory.data;

const years = wealthHealthRows.map((row) => row.year);
export const FIRST_YEAR = Math.min(...years);
export const LAST_YEAR = Math.max(...years);

/** The countries `playback.labels` names for the whole run. */
export const LABELLED = ["China", "India", "Nigeria"];

/** Regions in the order the rows first name them, so every chart colors a region alike. */
export const REGIONS = [...new Set(wealthHealthRows.map((row) => row.region))];

/** The bubble chart's encoding: wealth on a log x axis, health on y, people as size, region as color. */
export const wealthHealthEncoding = {
  x: {
    field: "gdp",
    type: "quantitative",
    scale: { type: "log" },
    axis: { title: "GDP per capita (current US$, log scale)", format: "$,.0f" },
  },
  y: {
    field: "life",
    type: "quantitative",
    axis: { title: "Life expectancy at birth (years)" },
  },
  size: { field: "pop", type: "quantitative", title: "Population" },
  color: { field: "region", type: "nominal", scale: { domain: REGIONS } },
  key: { field: "country", type: "nominal" },
  time: { field: "year", type: "temporal" },
} satisfies ChartSpec["encoding"];

/** The lead: every country and every year. */
export const wealthHealthSpec: ChartSpec = {
  mark: "point",
  data: wealthHealthRows,
  encoding: wealthHealthEncoding,
  playback: { duration: 25000, labels: LABELLED },
  chrome: {
    title: "China's life expectancy nearly doubled before its income reached $200 a person",
    subtitle: `GDP per capita and life expectancy for 62 countries, ${FIRST_YEAR}-${LAST_YEAR}. Circle size is population.`,
  },
};

// The lead is the post's hero, which paints one static pair at the desktop size, so
// only the figures below it take a taller phone stage.
const figure = { source: wealthHealthSource, height: 560 };
const phoneFigure = { ...figure, phoneHeight: 600 };

export const wealthHealthPlayback = defineDemo({
  ...figure,
  id: "blog/wealth-health-playback",
  title: `Wealth and health of 62 countries, ${FIRST_YEAR}-${LAST_YEAR}`,
  spec: wealthHealthSpec,
});

/** How many of the largest countries the printed spec keeps. */
const POPULOUS_COUNT = 10;
/** Every fifth year, counted back from the last so the run ends on it. */
const STEP_YEARS = 5;

/** The `count` most populous countries in `year`, largest first. */
export function mostPopulous(year: number, count: number): string[] {
  return wealthHealthRows
    .filter((row) => row.year === year && row.pop !== null)
    .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
    .slice(0, count)
    .map((row) => row.country);
}

export const POPULOUS = mostPopulous(LAST_YEAR, POPULOUS_COUNT);

/** Whole dollars and tenths of a year keep the printed rows short; the chart can't show finer. */
const printedRow = ({ country, region, year, gdp, life, pop }: WealthHealthHistoryRow) => ({
  country,
  region,
  year,
  gdp: gdp === null ? null : Math.round(gdp),
  life: life === null ? null : Math.round(life * 10) / 10,
  pop,
});

const populousRows = wealthHealthRows.filter(
  (row) => POPULOUS.includes(row.country) && (LAST_YEAR - row.year) % STEP_YEARS === 0,
);
const firstStepYear = Math.min(...populousRows.map((row) => row.year));

export const populousPlayback = defineDemo({
  ...phoneFigure,
  id: "blog/wealth-health-populous",
  title: `Wealth and health of the ${POPULOUS_COUNT} most populous countries, every ${STEP_YEARS} years`,
  height: 500,
  phoneHeight: 540,
  spec: {
    mark: "point",
    data: populousRows.map(printedRow),
    encoding: wealthHealthEncoding,
    playback: { labels: ["China", "Nigeria"] },
    chrome: {
      title: `Of the ${POPULOUS_COUNT} most populous countries, only Nigeria's life expectancy is under 60`,
      subtitle: `GDP per capita and life expectancy every ${STEP_YEARS} years, ${firstStepYear}-${LAST_YEAR}. Circle size is population.`,
    },
  },
});

/** The countries the trails figure follows. */
export const TRAILED = ["China", "India", "South Korea"];

export const wealthHealthTrails = defineDemo({
  ...phoneFigure,
  id: "blog/wealth-health-trails",
  title: `Wealth and health with trails for China, India and South Korea, ${FIRST_YEAR}-${LAST_YEAR}`,
  spec: {
    ...wealthHealthSpec,
    playback: { duration: 25000, labels: TRAILED, trails: TRAILED },
    chrome: {
      title: "China, India and South Korea reached a life expectancy of 60 on under $400 a person",
      subtitle: `GDP per capita and life expectancy, ${FIRST_YEAR}-${LAST_YEAR}. Lines trace each labelled country's path.`,
    },
  },
});
