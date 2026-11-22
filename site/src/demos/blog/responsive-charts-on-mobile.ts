/**
 * The figures in the blog post "Responsive charts on mobile": MLB strikeouts
 * and hits at the full article width and at a 360px phone layout, then US
 * import shares by partner with breakpoint overrides. Titles are computed from
 * the dataset rows so they cannot drift from the data. The post's `json demo`
 * fence repeats `importSharesResponsive.spec` verbatim, and a test keeps the
 * two in sync.
 */
import { mlbHitsVsStrikeouts } from "@datasets/mlb-hits-vs-strikeouts";
import { usImportShares } from "@datasets/us-import-shares";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/**
 * Series colors as light/dark pairs. Each one is also the color of its line's
 * end label, so each value clears 4.5:1 against its own page: the light teal
 * is the site accent, and the dark values are lightened until they pass on
 * the dark page (#0e0f10) and its panel (#17181a).
 */
const TEAL = { light: "#0e7490", dark: "#22a3c4" };
const ORANGE = { light: "#b54d00", dark: "#f07a2b" };
const GREY = { light: "#66707a", dark: "#9aa0a6" };

/** A phone-width layout, under the 400px compact breakpoint. */
const PHONE = 360;

const mlbRows = mlbHitsVsStrikeouts.data;
const mlbSource = sourceOf(mlbHitsVsStrikeouts);

/** Season totals as one row per season and measure, the shape a color channel needs. */
const mlbLong = mlbRows.flatMap((row) => [
  { year: String(row.year), measure: "Strikeouts", count: row.strikeouts },
  { year: String(row.year), measure: "Hits", count: row.hits },
]);

const firstOvertake = mlbRows.find((row) => row.strikeouts > row.hits);
if (!firstOvertake) throw new Error("Strikeouts never passed hits in the Lahman rows");
const everyLaterSeasonAhead = mlbRows
  .filter((row) => row.year >= firstOvertake.year)
  .every((row) => row.strikeouts > row.hits);
if (!everyLaterSeasonAhead)
  throw new Error("Strikeouts fell back below hits after the first overtake");
const shortened = mlbRows.find((row) => row.year === 2020);
if (!shortened) throw new Error("The 2020 season is missing from the Lahman rows");
const lastSeason = mlbRows.at(-1);
if (!lastSeason) throw new Error("The Lahman rows are empty");

const mlbSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
  data: mlbLong,
  encoding: {
    x: { field: "year", type: "temporal", axis: { format: "%Y" } },
    y: {
      field: "count",
      type: "quantitative",
      axis: { title: "Per season", format: ",.0f", grid: true },
    },
    color: {
      field: "measure",
      type: "nominal",
      scale: { domain: ["Strikeouts", "Hits"] },
    },
  },
  theme: { colors: { categorical: [TEAL, GREY] } },
  legend: { show: false },
  endpointLabels: true,
  // A demoted callout is numbered by its place in this list, so the side note
  // comes first and becomes note 1 at phone width, while `priority` keeps the
  // finding inline.
  annotations: [
    {
      type: "text",
      x: String(shortened.year),
      y: shortened.hits,
      text: "2020: 60-game season",
      anchor: "right",
      offset: { dx: -14, dy: 18 },
      connector: true,
    },
    {
      type: "text",
      x: String(firstOvertake.year),
      y: firstOvertake.strikeouts,
      text: `${firstOvertake.year}: strikeouts pass hits`,
      anchor: "top",
      offset: { dx: -40, dy: -28 },
      connector: true,
      background: true,
      priority: 1,
    },
  ],
  chromeLayout: "subtract",
  chrome: {
    title: `Strikeouts passed hits in ${firstOvertake.year} and have stayed ahead`,
    subtitle: `Hits and strikeouts by all MLB batters, per season, ${mlbRows[0]?.year}-${lastSeason.year}`,
  },
};

export const mlbStrikeoutsFull = defineDemo({
  id: "blog/mlb-strikeouts-full",
  title: "MLB strikeouts and hits at the article width",
  source: mlbSource,
  height: 440,
  spec: mlbSpec,
});

export const mlbStrikeoutsPhone = defineDemo({
  id: "blog/mlb-strikeouts-phone",
  title: "The same chart in a 360px container",
  source: mlbSource,
  height: 440,
  width: PHONE,
  spec: mlbSpec,
});

const COUNTRIES = [
  { id: "china_pct", name: "China" },
  { id: "mexico_pct", name: "Mexico" },
  { id: "canada_pct", name: "Canada" },
] as const;

const importRows = usImportShares.data;
const importSource = sourceOf(usImportShares);

const importLong = importRows.flatMap((row) =>
  COUNTRIES.map(({ id, name }) => ({ year: String(row.year), partner: name, share: row[id] })),
);

const chinaPeak = importRows.reduce((best, row) => (row.china_pct > best.china_pct ? row : best));
const chinaLast = importRows.at(-1);
if (!chinaLast) throw new Error("The import share rows are empty");
const mexicoPassed = importRows.find((row) => row.mexico_pct > row.china_pct && row.year > 2015);
if (!mexicoPassed) throw new Error("Mexico never passed China after 2015");

export const importSharesResponsive = defineDemo({
  id: "blog/import-shares-responsive",
  title: "US goods imports by partner, with phone overrides",
  source: importSource,
  height: 460,
  spec: {
    mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
    data: importLong,
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "share",
        type: "quantitative",
        axis: { title: "Share of US goods imports", format: ".0f", labelSuffix: "%", grid: true },
      },
      color: {
        field: "partner",
        type: "nominal",
        scale: { domain: ["China", "Mexico", "Canada"] },
      },
    },
    theme: { colors: { categorical: [TEAL, ORANGE, GREY] } },
    legend: { show: false },
    endpointLabels: { format: ".1f" },
    responsive: { preserveEnd: true },
    annotations: [
      {
        type: "text",
        x: String(chinaPeak.year),
        y: chinaPeak.china_pct,
        text: `China peaked at ${chinaPeak.china_pct.toFixed(1)}% in ${chinaPeak.year}`,
        anchor: "top",
        offset: { dx: -40, dy: -30 },
        connector: true,
      },
    ],
    overrides: {
      compact: {
        encoding: { x: { axis: { values: ["1995", "2005", "2015", "2024"] } } },
        chrome: {
          title: `China's share of US imports peaked in ${chinaPeak.year}`,
          subtitle: `Share of US goods imports, ${importRows[0]?.year}-${chinaLast.year}`,
        },
        annotations: [
          {
            type: "text",
            x: String(chinaPeak.year),
            y: chinaPeak.china_pct,
            text: `${chinaPeak.china_pct.toFixed(1)}%`,
            anchor: "top",
            offset: { dx: -36, dy: -30 },
            connector: true,
          },
        ],
      },
    },
    chromeLayout: "subtract",
    chrome: {
      title: `China's share of US goods imports peaked at ${chinaPeak.china_pct.toFixed(1)}% in ${chinaPeak.year}; Mexico passed it in ${mexicoPassed.year}`,
      subtitle: `Share of the value of US goods imports from China, Mexico and Canada, ${importRows[0]?.year}-${chinaLast.year}`,
    },
  },
});
