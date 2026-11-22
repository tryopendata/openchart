/**
 * Figures for the blog post "When to use a table instead of a chart": a ranked
 * horizontal bar chart showing one metric (PPP GDP per capita) across twelve
 * economies, followed by a sortable, searchable data table combining compact
 * populations, inline income bars and a life expectancy heatmap. Titles are
 * computed from the dataset rows so they cannot drift from the data.
 */
import { countryIndicators } from "@datasets/country-indicators";
import type { ChartSpec, ChartSpecOverride, TableSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { ACCENT } from "../the-spec/shared";
import { defineDemo } from "../types";

const rows = countryIndicators.data;
const source = sourceOf(countryIndicators);

/** Highest-income economy in the twelve-country set. */
const richest = rows.reduce((top, row) => (row.gdpPerCapita > top.gdpPerCapita ? row : top));
/** Lowest-income economy in the twelve-country set. */
const poorest = rows.reduce((low, row) => (row.gdpPerCapita < low.gdpPerCapita ? row : low));
/** Most populous economy in the set. */
const mostPopulous = rows.reduce((top, row) => (row.population > top.population ? row : top));
/** Longest-lived economy in the set. */
const longestLived = rows.reduce((top, row) =>
  row.lifeExpectancy > top.lifeExpectancy ? row : top,
);

const dollars = (value: number) => `$${value.toLocaleString("en-US")}`;
const incomeRatio = (richest.gdpPerCapita / poorest.gdpPerCapita).toFixed(1);

const PHONE_TICK_STEP = 20_000;

/** Ticks from 0 every $20k up to the richest economy's income rounded up to the next step. */
const phoneIncomeTicks = Array.from(
  { length: Math.ceil(richest.gdpPerCapita / PHONE_TICK_STEP) + 1 },
  (_, step) => step * PHONE_TICK_STEP,
);

/**
 * Phone widths (compact and medium breakpoints) print ticks as "$40k" because
 * the full "$80,000" runs past the right edge of a narrow figure, and pin a
 * tick every $20k because the engine otherwise thins the axis to two labels.
 */
const SHORT_DOLLAR_AXIS: ChartSpecOverride = {
  encoding: { x: { axis: { format: "$~s", values: phoneIncomeTicks } } },
};

const rankedBarSpec: ChartSpec = {
  mark: "bar",
  data: rows.map((row) => ({ ...row })),
  encoding: {
    x: {
      field: "gdpPerCapita",
      type: "quantitative",
      axis: {
        title: "GDP per capita (PPP, international $)",
        format: "$,.0f",
        tickCount: 5,
      },
    },
    y: { field: "country", type: "nominal", sort: "x" },
  },
  chrome: {
    title: `${richest.country} GDP per person is ${dollars(richest.gdpPerCapita)}, ${incomeRatio} times ${poorest.country}'s ${dollars(poorest.gdpPerCapita)}`,
    subtitle:
      "GDP per capita at purchasing power parity (constant international dollars), 12 large economies",
  },
  overrides: { compact: SHORT_DOLLAR_AXIS, medium: SHORT_DOLLAR_AXIS },
};

/** Horizontal bar chart ranking twelve large economies by PPP GDP per capita. */
export const economiesRankedBar = defineDemo({
  id: "blog/economies-ranked-bar",
  title: "PPP GDP per capita across twelve large economies",
  source,
  height: 440,
  spec: rankedBarSpec,
});

const tableSpec: TableSpec = {
  type: "table",
  data: rows.map((row) => ({ ...row })),
  columns: [
    { key: "country", label: "Country", sortable: true },
    {
      key: "population",
      label: "Population",
      format: "compact",
      sortable: true,
      align: "right",
    },
    {
      key: "gdpPerCapita",
      label: "GDP/capita (PPP)",
      format: "$,.0f",
      sortable: true,
      align: "right",
      bar: { color: ACCENT },
    },
    {
      key: "lifeExpectancy",
      label: "Life exp. (yrs)",
      format: ".1f",
      sortable: true,
      align: "right",
      heatmap: { palette: "green" },
    },
  ],
  sort: { column: "gdpPerCapita", direction: "desc" },
  density: "condensed",
  search: true,
  // Phones keep a scrolling grid with sortable headers rather than the
  // default one-card-per-country layout, so readers can still compare rows.
  mobileLayout: "scroll",
  chrome: {
    title: `${mostPopulous.country} leads on population, ${richest.country} on income and ${longestLived.country} on longevity`,
    subtitle:
      "Population, PPP GDP per capita (international $) and life expectancy (years), 12 large economies",
  },
};

/** Sortable, searchable table combining compact populations, inline income bars and life expectancy shading. */
export const economiesTable = defineDemo({
  id: "blog/economies-table",
  title: "Twelve large economies: population, income and life expectancy",
  source,
  height: 680,
  spec: tableSpec,
});
