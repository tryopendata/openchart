/**
 * The figures in the blog post "How to chart a range of values instead of
 * averages": Central Park monthly midpoints as columns, then the monthly
 * average daily low-to-high temperature range as floating bars. Titles state
 * findings computed from the dataset rows so they cannot drift from the data.
 * The post's `json demo` fence repeats `nycTempRange.spec` verbatim, and a
 * test holds the two together.
 */
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import type { ChartSpecOverride } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";

const MONTH_NAMES: Record<string, string> = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

/**
 * Phone widths (compact and medium breakpoints) label every other month
 * upright instead of rotating all twelve, which reads badly on a narrow plot.
 */
const PHONE_MONTH_AXIS: ChartSpecOverride = {
  encoding: { x: { axis: { labelAngle: 0, values: ["Jan", "Mar", "May", "Jul", "Sep", "Nov"] } } },
};

const rows = nycTemperatureRange.data;
const source = sourceOf(nycTemperatureRange);

const midpoints = rows.map((row) => ({
  month: row.month,
  midpoint: Number(((row.low + row.high) / 2).toFixed(1)),
}));

const spanOf = (row: (typeof rows)[number]) => Number((row.high - row.low).toFixed(1));

const coldestMid = midpoints.reduce((min, row) => (row.midpoint < min.midpoint ? row : min));
const warmestMid = midpoints.reduce((max, row) => (row.midpoint > max.midpoint ? row : max));
const widest = rows.reduce((max, row) => (spanOf(row) > spanOf(max) ? row : max));
const narrowest = rows.reduce((min, row) => (spanOf(row) < spanOf(min) ? row : min));

const midpointFinding = `ran from ${coldestMid.midpoint.toFixed(1)}°C in ${MONTH_NAMES[coldestMid.month]} to ${warmestMid.midpoint.toFixed(1)}°C in ${MONTH_NAMES[warmestMid.month]}`;

/** On phones the midpoint title drops "Monthly" so it fits in two lines. */
const midpointOnPhones: ChartSpecOverride = {
  ...PHONE_MONTH_AXIS,
  chrome: { title: `Midpoints ${midpointFinding}` },
};

export const nycTempMidpoint = defineDemo({
  id: "blog/nyc-temp-midpoint",
  title: "Central Park monthly midpoint temperature, 2023",
  source,
  height: 400,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: midpoints.map((row) => ({ ...row })),
    encoding: {
      x: { field: "month", type: "nominal" },
      y: {
        field: "midpoint",
        type: "quantitative",
        axis: { title: "Temperature (°C)" },
      },
    },
    labels: false,
    chrome: {
      title: `Monthly midpoints ${midpointFinding}`,
      subtitle:
        "Midpoint of average daily low and high temperature by month, Central Park, 2023 (°C)",
    },
    overrides: { compact: midpointOnPhones, medium: midpointOnPhones },
  },
});

export const nycTempRange = defineDemo({
  id: "blog/nyc-temp-range",
  title: "Central Park monthly temperature range, 2023",
  source,
  height: 440,
  spec: {
    mark: { type: "range", style: "bar", fill: ACCENT },
    data: rows.map((row) => ({ ...row })),
    encoding: {
      x: { field: "month", type: "nominal" },
      y: {
        field: "low",
        type: "quantitative",
        title: "Avg low",
        axis: { title: "Temperature (°C)" },
      },
      y2: { field: "high", type: "quantitative", title: "Avg high" },
    },
    chrome: {
      title: `${MONTH_NAMES[widest.month]} swung ${spanOf(widest).toFixed(1)}°C a day, against ${spanOf(narrowest).toFixed(1)}°C in ${MONTH_NAMES[narrowest.month]}`,
      subtitle:
        "Average daily low to average daily high temperature by month, Central Park, 2023 (°C)",
    },
    overrides: { compact: PHONE_MONTH_AXIS, medium: PHONE_MONTH_AXIS },
  },
});
