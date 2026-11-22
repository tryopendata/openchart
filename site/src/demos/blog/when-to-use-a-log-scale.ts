/**
 * Figures for the blog post "When to use a log scale on a scatter plot":
 * 12 large economies plotted by PPP GDP per capita against life expectancy on
 * a linear x-axis, then on a logarithmic x-axis with doubled tick marks and
 * three country callouts. Titles are computed from `countryIndicators.data` so
 * they cannot drift from the source rows, and a test pins the post's
 * `json demo` fence to `prestonLogScale.spec` verbatim.
 */
import { countryIndicators } from "@datasets/country-indicators";
import type { AnnotationOffset, TextAnnotation } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { ACCENT } from "../the-spec/shared";
import { defineDemo } from "../types";

const rows = countryIndicators.data;
const source = sourceOf(countryIndicators);

const usd = (value: number) => `$${value.toLocaleString("en-US")}`;

/** Lowest PPP GDP per capita in the dataset (India). */
const lowestIncome = rows.reduce((low, row) => (row.gdpPerCapita < low.gdpPerCapita ? row : low));
/** Highest PPP GDP per capita in the dataset (United States). */
const highestIncome = rows.reduce((high, row) =>
  row.gdpPerCapita > high.gdpPerCapita ? row : high,
);
/** Highest life expectancy in the dataset (Japan). */
const longestLived = rows.reduce((top, row) =>
  row.lifeExpectancy > top.lifeExpectancy ? row : top,
);
/** Brazil sits at almost exactly double India's PPP GDP per capita. */
const doubledFromLowest = rows.reduce((closest, row) =>
  Math.abs(row.gdpPerCapita - lowestIncome.gdpPerCapita * 2) <
  Math.abs(closest.gdpPerCapita - lowestIncome.gdpPerCapita * 2)
    ? row
    : closest,
);

const doublingLifeGain = Math.round(doubledFromLowest.lifeExpectancy - lowestIncome.lifeExpectancy);

type CountryRow = (typeof rows)[number];

/** A curved-leader callout naming a country with its income and life expectancy. */
const countryCallout = (
  row: CountryRow,
  anchor: TextAnnotation["anchor"],
  offset: AnnotationOffset,
): TextAnnotation => ({
  type: "text",
  x: row.gdpPerCapita,
  y: row.lifeExpectancy,
  text: `**${row.country}**\n${usd(row.gdpPerCapita)}, ${row.lifeExpectancy} years`,
  anchor,
  offset,
  connector: "curve",
});

/**
 * The same three callouts for phone widths (compact and medium breakpoints).
 * `responsive: false` stops the engine folding two of them into numbered
 * footnotes the prose never mentions, and India's label shifts right so it
 * clears the y-axis tick labels on a narrow plot.
 */
const phoneCallouts: TextAnnotation[] = [
  { ...countryCallout(lowestIncome, "top", { dx: 50, dy: -36 }), responsive: false },
  { ...countryCallout(longestLived, "left", { dx: -28, dy: -8 }), responsive: false },
  { ...countryCallout(highestIncome, "bottom", { dx: -36, dy: 42 }), responsive: false },
];

/** Shared scatter plot geometry and vertical scale so both charts share identical y marks. */
const prestonBase = {
  mark: { type: "point" as const, fill: ACCENT, size: 6 },
  data: rows.map((row) => ({ ...row })),
  encoding: {
    x: {
      field: "gdpPerCapita",
      type: "quantitative" as const,
      scale: { domain: [0, 80000] as [number, number] },
      axis: {
        title: "GDP per capita (PPP $, linear scale)",
        format: "$~s",
        values: [0, 20000, 40000, 60000, 80000],
        grid: true,
      },
    },
    y: {
      field: "lifeExpectancy",
      type: "quantitative" as const,
      scale: { zero: false, domain: [66, 86] as [number, number] },
      axis: { title: "Life expectancy at birth (years)", tickCount: 5, grid: true },
    },
    tooltip: [
      { field: "country", type: "nominal" as const, title: "Country" },
      { field: "gdpPerCapita", type: "quantitative" as const, title: "GDP per capita (PPP $)" },
      { field: "lifeExpectancy", type: "quantitative" as const, title: "Life expectancy (years)" },
    ],
  },
};

export const prestonLinearScale = defineDemo({
  id: "blog/preston-linear-scale",
  title: "Income and life expectancy on a linear axis",
  source,
  height: 440,
  spec: {
    ...prestonBase,
    chrome: {
      title: `GDP per capita runs from ${usd(lowestIncome.gdpPerCapita)} in ${lowestIncome.country} to ${usd(highestIncome.gdpPerCapita)} in the ${highestIncome.country}`,
      subtitle:
        "GDP per capita (PPP, constant international $) vs. life expectancy at birth in 12 large economies",
    },
  },
});

export const prestonLogScale = defineDemo({
  id: "blog/preston-log-scale",
  title: "Income and life expectancy on a log axis",
  source,
  height: 440,
  spec: {
    ...prestonBase,
    encoding: {
      ...prestonBase.encoding,
      x: {
        field: "gdpPerCapita",
        type: "quantitative",
        scale: { type: "log", domain: [8000, 90000], nice: false },
        axis: {
          title: "GDP per capita (PPP $, log scale)",
          format: "$~s",
          values: [10000, 20000, 40000, 80000],
          grid: true,
        },
      },
    },
    annotations: [
      countryCallout(lowestIncome, "top", { dx: 16, dy: -36 }),
      countryCallout(longestLived, "left", { dx: -28, dy: -8 }),
      countryCallout(highestIncome, "bottom", { dx: -36, dy: 42 }),
    ],
    overrides: {
      compact: { annotations: phoneCallouts },
      medium: { annotations: phoneCallouts },
    },
    chrome: {
      title: `Life expectancy rises ${doublingLifeGain} years from ${lowestIncome.country} to ${doubledFromLowest.country}, then flattens past ${longestLived.country}`,
      subtitle:
        "GDP per capita (PPP, log scale) vs. life expectancy at birth in 12 large economies",
    },
  },
});
