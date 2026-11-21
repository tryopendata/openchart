/**
 * Demos for the layers page (docs/composition/layers). Specs follow the Ladle
 * building blocks gallery: a `layer` array of chart specs drawn on one plot.
 */
import { collegeFinances } from "@datasets/college-finances";
import { stateEconomies } from "@datasets/state-economies";
import { usPayrolls } from "@datasets/us-payrolls";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const BLUE = "#0e7490";
const ORANGE = "#e07b39";

const averageJobs = Math.round(
  usPayrolls.data.reduce((sum, row) => sum + row.jobs, 0) / usPayrolls.data.length,
);

// Layers share scales; the explicit domain fixes the shared axis at 0 to 400.
const JOBS_DOMAIN: [number, number] = [0, 400];

export const barAndRuleLayers = defineDemo({
  id: "composition/layer-bars-rule",
  title: "Payroll bars with an average rule",
  source: sourceOf(usPayrolls),
  height: 440,
  spec: {
    chrome: {
      title: `Employers added an average of ${averageJobs},000 jobs a month in 2024`,
      subtitle:
        "Monthly US nonfarm payroll additions, 2024, with the yearly average drawn as a second layer",
    },
    layer: [
      {
        mark: { type: "bar", fill: BLUE, opacity: 0.85 },
        data: [...usPayrolls.data],
        encoding: {
          x: { field: "month", type: "nominal" },
          y: {
            field: "jobs",
            type: "quantitative",
            scale: { domain: JOBS_DOMAIN },
            axis: { title: "Jobs added (thousands)" },
          },
        },
        labels: { density: "none" },
      },
      {
        mark: { type: "rule" },
        data: [{ avg: averageJobs, label: `avg: ${averageJobs}K` }],
        encoding: {
          y: { field: "avg", type: "quantitative", scale: { domain: JOBS_DOMAIN } },
          color: { field: "label", type: "nominal", scale: { range: ["#334155"] } },
        },
      },
    ],
  },
});

const POPULATION_DOMAIN: [number, number] = [5, 43];
const GDP_DOMAIN: [number, number] = [0.6, 4.25];
const LABELED = new Set(["CA", "TX", "NY", "FL", "IL"]);

export const pointAndTextLayers = defineDemo({
  id: "composition/layer-direct-labels",
  title: "State economies with direct labels",
  source: sourceOf(stateEconomies),
  height: 460,
  spec: {
    chrome: {
      title: "California has the largest economy and population of any state",
      subtitle: "The ten largest US state economies by GDP and population, 2023",
    },
    layer: [
      {
        mark: { type: "point", fill: BLUE, opacity: 0.85, trendline: false },
        data: [...stateEconomies.data],
        encoding: {
          x: {
            field: "gdp",
            type: "quantitative",
            scale: { domain: GDP_DOMAIN },
            axis: { title: "GDP ($ trillions)" },
          },
          y: {
            field: "pop",
            type: "quantitative",
            scale: { domain: POPULATION_DOMAIN },
            axis: { title: "Population (millions)" },
          },
        },
      },
      {
        mark: { type: "text", dy: -14 },
        data: stateEconomies.data.filter((row) => LABELED.has(row.label)),
        encoding: {
          x: { field: "gdp", type: "quantitative", scale: { domain: GDP_DOMAIN } },
          y: { field: "pop", type: "quantitative", scale: { domain: POPULATION_DOMAIN } },
          text: { field: "label", type: "nominal" },
          size: { field: "gdp", type: "quantitative", scale: { range: [11, 22] } },
        },
      },
    ],
  },
});

export const dualAxisLayers = defineDemo({
  id: "composition/layer-dual-axis",
  title: "Net revenue and enrollment on independent axes",
  source: sourceOf(collegeFinances),
  height: 460,
  spec: {
    chrome: {
      title: "Net revenue fell into deficit as enrollment declined",
      subtitle:
        "Net revenue (bars) and undergraduate enrollment (line) on independent y-axes, 2014-2024",
    },
    resolve: { scale: { y: "independent" } },
    layer: [
      {
        mark: { type: "bar", opacity: 0.85 },
        data: [...collegeFinances.data],
        encoding: {
          x: { field: "year", type: "ordinal" },
          y: {
            field: "revenue",
            type: "quantitative",
            axis: {
              title: "Net revenue ($)",
              format: "~s",
              labelColor: BLUE,
              values: [-40_000_000, -20_000_000, 0, 20_000_000, 40_000_000, 60_000_000, 80_000_000],
            },
          },
          color: {
            condition: { test: { field: "revenue", gte: 0 }, value: BLUE },
            value: "#d64045",
          },
        },
        labels: { density: "none" },
      },
      {
        mark: {
          type: "line",
          stroke: ORANGE,
          strokeWidth: 2.5,
          point: true,
          interpolate: "monotone",
        },
        data: [...collegeFinances.data],
        encoding: {
          x: { field: "year", type: "ordinal" },
          y: {
            field: "enrollment",
            type: "quantitative",
            axis: { title: "Enrollment", format: "~s", labelColor: ORANGE },
            scale: { domain: [46_000, 66_000] },
          },
        },
        labels: { density: "none" },
      },
    ],
  },
});
