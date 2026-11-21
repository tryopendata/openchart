/**
 * Demos for the transforms page (docs/the-spec/transforms). Each spec carries
 * its source rows unchanged and derives the plotted numbers in `transform`.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { ACCENT, CENTRAL_PARK_2023, ELECTRICITY_SUBTITLE, WARM } from "./shared";

const temperatureRows = nycTemperatureRange.data.map((row) => ({ ...row }));
const temperatureAxis = { format: ".0f", labelSuffix: "°C", grid: true };

export const transformsFold = defineDemo({
  id: "the-spec/transforms-fold",
  title: "Central Park's average daily low and high, folded into two lines",
  source: sourceOf(nycTemperatureRange),
  height: 420,
  spec: {
    mark: { type: "line", strokeWidth: 2, point: true },
    data: temperatureRows,
    transform: [{ fold: ["high", "low"], as: ["measure", "temperature"] }],
    encoding: {
      x: { field: "month", type: "ordinal", sort: null, axis: { title: "2023" } },
      y: {
        field: "temperature",
        type: "quantitative",
        axis: { ...temperatureAxis, title: "Temperature" },
      },
      color: {
        field: "measure",
        type: "nominal",
        scale: { domain: ["high", "low"], range: [WARM, ACCENT] },
      },
    },
    endpointLabels: { content: "label" },
    chrome: {
      title: "Central Park's daily highs and lows both peaked in July 2023",
      subtitle: `Monthly average of each day's high and low temperature, ${CENTRAL_PARK_2023}`,
    },
  },
});

export const transformsCalculate = defineDemo({
  id: "the-spec/transforms-calculate",
  title: "Central Park's daily temperature swing by month",
  source: sourceOf(nycTemperatureRange),
  height: 400,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: temperatureRows,
    transform: [{ calculate: { op: "-", field: "high", field2: "low" }, as: "swing" }],
    encoding: {
      x: { field: "month", type: "ordinal", sort: null, axis: { title: "2023" } },
      y: {
        field: "swing",
        type: "quantitative",
        axis: { ...temperatureAxis, title: "High minus low" },
      },
    },
    labels: { format: ".1f" },
    chrome: {
      title: "Central Park's gap between daily high and low was widest in May 2023, at 10.1°C",
      subtitle: `Average daily high minus average daily low by month, ${CENTRAL_PARK_2023}`,
    },
  },
});

export const transformsAggregate = defineDemo({
  id: "the-spec/transforms-aggregate",
  title: "Wind and solar's combined share of generation",
  source: sourceOf(electricityMixMatrix),
  height: 400,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: electricityMixMatrix.data.map((row) => ({ ...row })),
    transform: [
      { filter: { field: "source", oneOf: ["Wind", "Solar"] } },
      { aggregate: [{ op: "sum", field: "share", as: "windSolar" }], groupby: ["year"] },
    ],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "windSolar",
        type: "quantitative",
        axis: { title: "Wind plus solar", format: ".0f", labelSuffix: "%" },
      },
    },
    labels: { format: ".1f" },
    chrome: {
      title:
        "Wind and solar went from 7.1% of generation from the six main sources in 2016 to 15.9% in 2023",
      subtitle: `${ELECTRICITY_SUBTITLE}, wind and solar combined`,
    },
  },
});

const stateRates = Object.entries(usStateUnemployment.data).map(([state, rate]) => ({
  state,
  rate,
}));

export const transformsBin = defineDemo({
  id: "the-spec/transforms-bin",
  title: "State unemployment rates binned into half-point ranges",
  source: sourceOf(usStateUnemployment),
  height: 400,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: stateRates,
    transform: [
      { bin: { step: 0.5, extent: [2, 6] }, field: "rate", as: ["rateFrom", "rateTo"] },
      {
        aggregate: [{ op: "count", field: "state", as: "states" }],
        groupby: ["rateFrom", "rateTo"],
      },
    ],
    encoding: {
      x: {
        field: "rateFrom",
        type: "quantitative",
        axis: { title: "Unemployment rate", format: ".1f", labelSuffix: "%" },
      },
      x2: { field: "rateTo", type: "quantitative" },
      y: { field: "states", type: "quantitative", axis: { title: "States", tickCount: 4 } },
    },
    labels: { format: ".0f" },
    chrome: {
      title: "Unemployment was between 3% and 5% in 38 of the 50 states and DC",
      subtitle:
        "Number of states by unemployment rate, in half-point ranges. Seasonally adjusted, latest month.",
    },
  },
});
