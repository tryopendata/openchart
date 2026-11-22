/**
 * The figures in the blog post "How to make a heatmap in JavaScript": green
 * cards by country of birth and fiscal year with every cell labeled, then
 * Mauna Loa CO2 by year and month on one sequential scale, then the same grid
 * colored by each month's distance from its own year's average on a diverging
 * scale. Titles state findings computed from the dataset rows so they cannot
 * drift from the data. The post's `json demo` fence repeats `co2Seasonal.spec`
 * verbatim, and a test holds the two together.
 */
import { co2MaunaLoa } from "@datasets/co2-mauna-loa";
import { greenCardsByCountry } from "@datasets/green-cards-by-country";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const COUNTRIES = [
  { field: "mexico", name: "Mexico" },
  { field: "india", name: "India" },
  { field: "china", name: "China" },
  { field: "cuba", name: "Cuba" },
  { field: "dominican_republic", name: "Dominican Republic" },
  { field: "philippines", name: "Philippines" },
] as const;

/** One row per country and fiscal year, in thousands of green cards rounded to a whole number. */
export const greenCardCells = greenCardsByCountry.data.flatMap((row) =>
  COUNTRIES.map(({ field, name }) => ({
    country: name,
    year: String(row.year),
    cards: Math.round(row[field] / 1000),
  })),
);

const total = (year: number) => greenCardsByCountry.data.find((row) => row.year === year);
const allFell = COUNTRIES.every(({ field }) => {
  const before = total(2019)?.[field] ?? 0;
  const after = total(2020)?.[field] ?? 0;
  return after < before;
});
const fallPercent = Math.round(
  (1 - (total(2020)?.all_countries ?? 0) / (total(2019)?.all_countries ?? 1)) * 100,
);

/** Cells at or above this many thousand are dark enough to need white text. */
const DARK_CELL = 100;

const greenCardAxes = {
  x: { field: "year", type: "nominal" as const },
  y: {
    field: "country",
    type: "nominal" as const,
    // Listed from the bottom of the axis up, so Mexico, the largest, sits on top.
    sort: [...COUNTRIES].reverse().map(({ name }) => name),
  },
};

export const greenCardHeatmap = defineDemo({
  id: "blog/green-cards-heatmap",
  title: "Green cards by country of birth and fiscal year, 2014 to 2023",
  source: sourceOf(greenCardsByCountry),
  height: 420,
  spec: {
    layer: [
      {
        mark: "rect",
        data: greenCardCells,
        encoding: {
          ...greenCardAxes,
          color: {
            field: "cards",
            type: "quantitative",
            scale: { scheme: "blue" },
            format: ",.0f",
          },
        },
      },
      {
        mark: { type: "text", fill: "#ffffff", fontSize: 12 },
        transform: [{ filter: { field: "cards", gte: DARK_CELL } }],
        data: greenCardCells,
        encoding: { ...greenCardAxes, text: { field: "cards", type: "quantitative" } },
      },
      {
        mark: { type: "text", fill: "#0f172a", fontSize: 12 },
        transform: [{ filter: { field: "cards", lt: DARK_CELL } }],
        data: greenCardCells,
        encoding: { ...greenCardAxes, text: { field: "cards", type: "quantitative" } },
      },
    ],
    chrome: {
      title: allFell
        ? `All six countries fell in fiscal 2020, and the total dropped ${fallPercent}%`
        : "Green cards by country of birth",
      subtitle:
        "Lawful permanent residents by country of birth and fiscal year, thousands. Darker cells are larger.",
    },
  },
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = [...new Set(co2MaunaLoa.data.map((row) => row.year))].sort((a, b) => a - b);

/** Rows listed from the bottom of the axis up, so the earliest year is drawn on top. */
const yearOrder = [...YEARS].reverse().map(String);

const yearMean = (year: number) => {
  const values = co2MaunaLoa.data.filter((row) => row.year === year).map((row) => row.co2_ppm);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/** Monthly mean CO2 with month names for the x axis. */
export const co2Cells = co2MaunaLoa.data.map((row) => ({
  year: String(row.year),
  month: MONTHS[row.month - 1] ?? String(row.month),
  ppm: row.co2_ppm,
}));

/** Each month's distance from its own year's average, to one decimal. */
export const co2Departures = co2MaunaLoa.data.map((row) => ({
  year: String(row.year),
  month: MONTHS[row.month - 1] ?? String(row.month),
  departure: Number((row.co2_ppm - yearMean(row.year)).toFixed(1)),
}));

const first = co2MaunaLoa.data.filter((row) => row.year === YEARS[0]);
const last = co2MaunaLoa.data.filter((row) => row.year === YEARS.at(-1));
const peak = (rows: typeof first) => Math.max(...rows.map((row) => row.co2_ppm));
const trough = (rows: typeof first) => Math.min(...rows.map((row) => row.co2_ppm));
/** How far the lowest month of the last year sits above the highest month of the first. */
export const gapPpm = Number((trough(last) - peak(first)).toFixed(0));

const co2Source = sourceOf(co2MaunaLoa);

export const co2Trend = defineDemo({
  id: "blog/co2-heatmap",
  title: "Mauna Loa CO2 by month for five years, one color scale",
  source: co2Source,
  height: 380,
  spec: {
    mark: "rect",
    data: co2Cells,
    encoding: {
      x: { field: "month", type: "nominal", sort: MONTHS },
      y: { field: "year", type: "nominal", sort: yearOrder },
      color: {
        field: "ppm",
        type: "quantitative",
        scale: { scheme: "blue" },
        format: ".1f",
      },
    },
    chrome: {
      title: `The lowest month of ${YEARS.at(-1)} was ${gapPpm} ppm above the highest month of ${YEARS[0]}`,
      subtitle: "Monthly mean CO2 at Mauna Loa, parts per million. Darker cells are higher.",
    },
  },
});

export const co2Seasonal = defineDemo({
  id: "blog/co2-seasonal-heatmap",
  title: "Mauna Loa CO2 by month, relative to each year's average",
  source: co2Source,
  height: 380,
  spec: {
    mark: "rect",
    data: co2Departures,
    encoding: {
      x: { field: "month", type: "nominal", sort: MONTHS },
      y: { field: "year", type: "nominal", sort: yearOrder },
      color: {
        field: "departure",
        type: "quantitative",
        scale: { scheme: "redBlue", domain: [-4, 4], reverse: true },
        format: "+.1f",
      },
    },
    chrome: {
      title: "In every year, CO2 peaks in spring and bottoms out in autumn",
      subtitle:
        "Monthly mean CO2 at Mauna Loa minus that year's average, ppm. Red is above the year's average, blue below.",
    },
  },
});
