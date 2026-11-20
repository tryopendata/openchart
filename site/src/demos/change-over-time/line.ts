/**
 * Demos for the line chart page (docs/change-over-time/line). Specs follow the
 * Ladle line and area gallery; each takes its data and citation from one
 * dataset module in examples/src/data.
 */
import { bigTechRevenue } from "@datasets/big-tech-revenue";
import { evFleet } from "@datasets/ev-fleet";
import { gdpGrowthByCountry } from "@datasets/gdp-growth-by-country";
import { monthlyTemperature } from "@datasets/monthly-temperature";
import { usInflation } from "@datasets/us-inflation";
import { defineDemo } from "../types";
import { sourceOf } from "./source";

const ACCENT = "#0e7490";

export const basicLine = defineDemo({
  id: "change-over-time/line-basic",
  title: "US inflation",
  source: sourceOf(usInflation),
  height: 440,
  spec: {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2 },
    data: [...usInflation.data],
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        axis: { title: "CPI (year-over-year %)", format: ".1f", grid: true },
      },
    },
    annotations: [
      {
        type: "text",
        x: "2022-07-01",
        y: 8.5,
        text: "Peak: 8.5%",
        anchor: "top",
        offset: { dx: 0, dy: -20 },
        connector: true,
      },
      {
        type: "refline",
        y: 2,
        label: "Fed 2% target",
        style: "dashed",
        stroke: "#64748b",
        strokeWidth: 1,
      },
    ],
    chrome: {
      title: "Inflation rose from 1% to 8.5% and came back down",
      subtitle: "US consumer price index, year-over-year % change, quarterly 2019-2024",
    },
  },
});

export const multiSeriesLine = defineDemo({
  id: "change-over-time/line-series",
  title: "GDP growth in three economies",
  source: sourceOf(gdpGrowthByCountry),
  height: 460,
  spec: {
    mark: "line",
    data: [...gdpGrowthByCountry.data],
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 4 } },
      y: {
        field: "gdp",
        type: "quantitative",
        axis: { title: "GDP growth (%)", format: "+.0f", grid: true },
      },
      color: { field: "country", type: "nominal" },
    },
    annotations: [
      { type: "refline", y: 0, style: "solid", stroke: "#94a3b8", strokeWidth: 1 },
      {
        type: "range",
        x1: "2019-09-01",
        x2: "2020-06-01",
        label: "Pandemic",
        fill: "#dc2626",
        opacity: 0.06,
      },
    ],
    endpointLabels: { format: "+.1f" },
    chrome: {
      title: "Three economies, three recoveries",
      subtitle: "Annual real GDP growth rate, 2018-2024",
    },
  },
});

export const focusedLine = defineDemo({
  id: "change-over-time/line-focus",
  title: "Big tech revenue with one company in focus",
  source: sourceOf(bigTechRevenue),
  height: 460,
  spec: {
    mark: "line",
    data: [...bigTechRevenue.data],
    encoding: {
      x: { field: "year", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "revenue",
        type: "quantitative",
        axis: { title: "Annual revenue ($B)", format: ",.0f", grid: true },
      },
      color: {
        field: "company",
        type: "nominal",
        scale: {
          domain: ["Amazon", "Apple", "Alphabet", "Microsoft", "Meta"],
          range: [ACCENT, "#7a858f", "#7a858f", "#7a858f", "#7a858f"],
        },
      },
    },
    legend: { show: false },
    endpointLabels: { content: "label", showMarker: true },
    seriesStyles: { Amazon: { strokeWidth: 3 } },
    chrome: {
      title: "Amazon pulls away at the top of big tech",
      subtitle: "Annual revenue by company, 2019-2024 (billions USD)",
    },
  },
});

export const steppedLine = defineDemo({
  id: "change-over-time/line-step",
  title: "Monthly temperature as a step line",
  source: sourceOf(monthlyTemperature),
  height: 360,
  spec: {
    mark: { type: "line", interpolate: "step", point: true, stroke: ACCENT, strokeWidth: 2 },
    data: [...monthlyTemperature.data],
    encoding: {
      x: { field: "month", type: "ordinal" },
      y: {
        field: "temp",
        type: "quantitative",
        axis: { title: "Temperature (°C)", grid: true, tickCount: 5 },
      },
    },
    chrome: {
      title: "A step line holds each value until the next point",
      subtitle: 'Monthly temperature with interpolate: "step"',
    },
  },
});

// The rate is a whole-number percent; as a fraction, the format ".0%" prints "8%".
const inflationFractions = usInflation.data.map((row) => ({
  date: row.date,
  rate: row.rate / 100,
}));

export const timeAxisLine = defineDemo({
  id: "change-over-time/line-time-axis",
  title: "US inflation with compact date ticks",
  source: sourceOf(usInflation),
  height: 420,
  spec: {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2 },
    data: inflationFractions,
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%b '%y", tickCount: 8 } },
      y: {
        field: "rate",
        type: "quantitative",
        axis: { title: "CPI (year-over-year)", format: ".0%", grid: true },
      },
    },
    chrome: {
      title: "A custom tick format keeps a dense time axis readable",
      subtitle: "Quarterly 2019-2024, ticks formatted as month and two-digit year",
    },
  },
});

export const logLine = defineDemo({
  id: "change-over-time/line-log",
  title: "Electric car fleet on a log scale",
  source: sourceOf(evFleet),
  height: 440,
  spec: {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2, point: true },
    data: [...evFleet.data],
    encoding: {
      x: { field: "year", type: "temporal", axis: { tickCount: 5 } },
      y: {
        field: "fleet",
        type: "quantitative",
        scale: { type: "log" },
        axis: { title: "Cumulative EV fleet (millions, log)", format: ",.0f", grid: true },
      },
    },
    chrome: {
      title: "On a log scale, steady growth plots as a straight line",
      subtitle: "Cumulative global electric car fleet, 2015-2024 (BEV + PHEV)",
    },
  },
});
