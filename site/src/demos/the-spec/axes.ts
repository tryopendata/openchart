/**
 * Demos for the axes page (docs/the-spec/axes): tick formats and gridlines,
 * long category labels, and a hidden axis when value labels carry the numbers.
 */
import { countryIndicators } from "@datasets/country-indicators";
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { ACCENT, CENTRAL_PARK_2023 } from "./shared";

export const axesFormat = defineDemo({
  id: "the-spec/axes-format",
  title: "Central Park's average daily high by month",
  source: sourceOf(nycTemperatureRange),
  height: 400,
  spec: {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2, point: true },
    data: nycTemperatureRange.data.map(({ month, high }) => ({ month, high })),
    encoding: {
      x: { field: "month", type: "ordinal", sort: null, axis: { title: "2023" } },
      y: {
        field: "high",
        type: "quantitative",
        axis: {
          title: "Average daily high",
          format: ".0f",
          labelSuffix: "°C",
          tickCount: 4,
          grid: true,
        },
      },
    },
    chrome: {
      title: "Central Park's average daily high peaked at 30.2°C in July 2023",
      subtitle: `Average of each day's high temperature by month, ${CENTRAL_PARK_2023}`,
    },
  },
});

export const axesLongLabels = defineDemo({
  id: "the-spec/axes-long-labels",
  title: "GDP per person in 12 large economies",
  source: sourceOf(countryIndicators),
  height: 420,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: countryIndicators.data.map(({ country, gdpPerCapita }) => ({ country, gdpPerCapita })),
    encoding: {
      x: { field: "country", type: "nominal", sort: "-y" },
      y: {
        field: "gdpPerCapita",
        type: "quantitative",
        axis: { title: "GDP per person", format: "$,.0f" },
      },
    },
    labels: false,
    chrome: {
      title: "GDP per person in the US is almost eight times India's",
      subtitle: "GDP per person, PPP-adjusted, constant international dollars, about 2022",
    },
  },
});

/** Names for the states the chart shows; the dataset keys rows by postal code. */
const STATE_NAMES: Readonly<Record<string, string>> = {
  CA: "California",
  DC: "District of Columbia",
  DE: "Delaware",
  IL: "Illinois",
  MI: "Michigan",
  NV: "Nevada",
  OR: "Oregon",
  WA: "Washington",
};

// The cut at 5.1% keeps whole ties: the next rate down, 4.9%, is shared by three states.
const highestRates = Object.entries(usStateUnemployment.data)
  .filter(([, rate]) => rate >= 5.1)
  .map(([code, rate]) => ({ state: STATE_NAMES[code] ?? code, rate }));

export const axesHidden = defineDemo({
  id: "the-spec/axes-hidden",
  title: "The highest state unemployment rates",
  source: sourceOf(usStateUnemployment),
  height: 400,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: highestRates,
    encoding: {
      y: { field: "state", type: "nominal", sort: "x" },
      x: { field: "rate", type: "quantitative", axis: false },
    },
    labels: { format: ".1f", suffix: "%" },
    chrome: {
      title: "DC had the highest unemployment rate, 5.7%, followed by Delaware at 5.4%",
      subtitle:
        "Unemployment rate, seasonally adjusted, latest month (% of labor force). The eight highest of the 50 states and DC.",
    },
  },
});
