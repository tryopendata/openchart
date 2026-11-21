/**
 * Demos for the annotations page (docs/framing/annotations): a text callout
 * with a connector, a reference line at an average, a shaded range, and one
 * highlighted series with a note.
 */
import { countryIndicators } from "@datasets/country-indicators";
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import { usInflation } from "@datasets/us-inflation";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";

export const annotationsCallout = defineDemo({
  id: "framing/annotations-callout",
  title: "Income and life expectancy with the US called out",
  source: sourceOf(countryIndicators),
  height: 460,
  spec: {
    mark: { type: "point", fill: ACCENT, size: 6, trendline: false },
    data: countryIndicators.data.map(({ country, gdpPerCapita, lifeExpectancy }) => ({
      country,
      gdpPerCapita,
      lifeExpectancy,
    })),
    encoding: {
      x: {
        field: "gdpPerCapita",
        type: "quantitative",
        axis: { title: "GDP per person (PPP, constant international $)", format: "$,.0f" },
      },
      y: {
        field: "lifeExpectancy",
        type: "quantitative",
        scale: { zero: false },
        axis: { title: "Life expectancy at birth (years)" },
      },
      tooltip: { field: "country", type: "nominal", title: "Country" },
    },
    annotations: [
      {
        type: "text",
        x: 75489,
        y: 79.2,
        text: "**United States**\n$75,489 per person, 79.2 years",
        anchor: "bottom",
        offset: { dx: -40, dy: 40 },
        connector: "curve",
      },
    ],
    chrome: {
      title: "The US has the highest income of these 12 countries, but six of them live longer",
      subtitle: "GDP per person against life expectancy at birth in 12 large economies",
    },
  },
});

/** Mean of the twelve monthly highs: 218.8 / 12. */
const meanHigh =
  nycTemperatureRange.data.reduce((sum, row) => sum + row.high, 0) /
  nycTemperatureRange.data.length;

export const annotationsRefline = defineDemo({
  id: "framing/annotations-refline",
  title: "Central Park's monthly highs against the yearly mean",
  source: sourceOf(nycTemperatureRange),
  height: 400,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: nycTemperatureRange.data.map(({ month, high }) => ({ month, high })),
    encoding: {
      x: { field: "month", type: "ordinal", sort: null, axis: { title: "2023" } },
      y: {
        field: "high",
        type: "quantitative",
        axis: { title: "Average daily high", format: ".0f", labelSuffix: "°C" },
      },
    },
    labels: false,
    annotations: [
      {
        type: "refline",
        y: meanHigh,
        label: `Yearly mean ${meanHigh.toFixed(1)}°C`,
        style: "dashed",
        strokeWidth: 1.5,
      },
    ],
    chrome: {
      title: "Seven months of 2023 had average highs above Central Park's yearly mean",
      subtitle: "Average daily high by month, Central Park, New York, 2023 (°C)",
    },
  },
});

export const annotationsRange = defineDemo({
  id: "framing/annotations-range",
  title: "US inflation with the stretch above 5% shaded",
  source: sourceOf(usInflation),
  height: 420,
  spec: {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2 },
    data: usInflation.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        // Headroom above the 8.5% peak keeps the range label clear of the line.
        scale: { domain: [0, 10] },
        axis: { title: "Change from a year earlier", format: ".0f", labelSuffix: "%" },
      },
    },
    annotations: [
      {
        type: "range",
        x1: "2021-07-01",
        x2: "2023-01-01",
        label: "Above 5%",
        opacity: 0.12,
      },
    ],
    chrome: {
      title:
        "US inflation stayed above 5% for seven straight quarters, from mid-2021 to early 2023",
      subtitle: "Consumer price index, % change from a year earlier, quarterly, 2019–2024",
    },
  },
});

export const annotationsHighlight = defineDemo({
  id: "framing/annotations-highlight",
  title: "US electricity sources with coal highlighted",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: { type: "line", strokeWidth: 2 },
    data: electricityMixMatrix.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "share",
        type: "quantitative",
        axis: { title: "Share of generation", format: ".0f", labelSuffix: "%" },
      },
      color: { field: "source", type: "nominal", highlight: "Coal" },
    },
    endpointLabels: { content: "label" },
    seriesStyles: { Coal: { strokeWidth: 3 } },
    annotations: [
      {
        type: "text",
        x: "2020",
        y: 19.6,
        text: "Coal fell below **20%** in 2020",
        anchor: "bottom",
        offset: { dx: 0, dy: 28 },
        connector: true,
      },
    ],
    chrome: {
      title: "Coal's share of US electricity nearly halved between 2016 and 2023",
      subtitle: "Share of US generation by source (%), 2016–2023. Coal went from 31.2% to 16.2%.",
    },
  },
});
