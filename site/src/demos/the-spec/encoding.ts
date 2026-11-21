/**
 * Demos for the encoding page (docs/the-spec/encoding): country rows through
 * the position, color and size channels.
 */
import { countryIndicators } from "@datasets/country-indicators";
import { populationByCountry } from "@datasets/population";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { ACCENT, GREY } from "./shared";

/** Population in millions, so ticks read "1,400" instead of "1.4G". */
const populationMillions = populationByCountry.data.map((row) => ({
  country: row.country,
  population: row.population / 1_000_000,
}));

const populationChrome = {
  title: "India and China each have more than four times as many people as the US",
  subtitle: "Population of the ten most populous countries, 2025 (millions)",
};

const populationAxis = { title: "Population (millions)", format: ",.0f" };

export const encodingBar = defineDemo({
  id: "the-spec/encoding-bar",
  title: "Population of the ten most populous countries as bars",
  source: sourceOf(populationByCountry),
  height: 420,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: populationMillions,
    encoding: {
      y: { field: "country", type: "nominal", sort: "x" },
      x: { field: "population", type: "quantitative", axis: populationAxis },
    },
    labels: false,
    chrome: populationChrome,
  },
});

export const encodingColumn = defineDemo({
  id: "the-spec/encoding-column",
  title: "Population of the ten most populous countries as columns",
  source: sourceOf(populationByCountry),
  height: 420,
  spec: {
    mark: { type: "bar", fill: ACCENT },
    data: populationMillions,
    encoding: {
      x: { field: "country", type: "nominal", sort: "-y" },
      y: { field: "population", type: "quantitative", axis: populationAxis },
    },
    labels: false,
    chrome: populationChrome,
  },
});

const countries = countryIndicators.data.map(
  ({ country, population, gdpPerCapita, lifeExpectancy }) => ({
    country,
    population: population / 1_000_000,
    gdpPerCapita,
    lifeExpectancy,
  }),
);

/** GDP per person above which a country is drawn in the accent color. */
const RICH = 40_000;

export const encodingColor = defineDemo({
  id: "the-spec/encoding-color",
  title: "Life expectancy, colored by GDP per person",
  source: sourceOf(countryIndicators),
  height: 480,
  spec: {
    mark: "bar",
    data: countries,
    encoding: {
      y: { field: "country", type: "nominal", sort: "x" },
      x: {
        field: "lifeExpectancy",
        type: "quantitative",
        axis: { title: "Life expectancy at birth (years)" },
      },
      color: {
        condition: { test: { field: "gdpPerCapita", gte: RICH }, value: ACCENT },
        value: GREY,
      },
    },
    labels: { format: ".1f" },
    chrome: {
      title:
        "The seven countries here with GDP per person above $40,000 also have the longest lives",
      subtitle:
        "Life expectancy at birth (years). Teal bars: GDP per person above $40,000 (PPP, constant international $).",
    },
  },
});

export const encodingSize = defineDemo({
  id: "the-spec/encoding-size",
  title: "Income and life expectancy, sized by population",
  source: sourceOf(countryIndicators),
  height: 480,
  spec: {
    mark: { type: "point", fill: ACCENT, opacity: 0.7, trendline: false },
    data: countries,
    encoding: {
      x: {
        field: "gdpPerCapita",
        type: "quantitative",
        axis: { title: "GDP per person (PPP, constant international $)", format: "$,.0f" },
      },
      y: {
        field: "lifeExpectancy",
        type: "quantitative",
        axis: { title: "Life expectancy at birth (years)" },
      },
      // A domain and range that both start at zero keep circle area proportional to population.
      size: {
        field: "population",
        type: "quantitative",
        title: "Population (millions)",
        format: ",.0f",
        scale: { domain: [0, 1500], range: [0, 22] },
      },
      tooltip: [
        { field: "country", type: "nominal", title: "Country" },
        {
          field: "population",
          type: "quantitative",
          title: "Population (millions)",
          format: ",.0f",
        },
      ],
    },
    annotations: [
      {
        type: "text",
        x: 9818,
        y: 68.3,
        text: "India",
        anchor: "top",
        offset: { dy: -30 },
        connector: false,
        responsive: false,
      },
      {
        type: "text",
        x: 23846,
        y: 76.1,
        text: "China",
        anchor: "right",
        offset: { dx: 34 },
        connector: false,
        responsive: false,
      },
    ],
    chrome: {
      title:
        "India and China hold two-thirds of these 12 countries' people, and India has the lowest income",
      subtitle: "GDP per person against life expectancy at birth. Circle area is population.",
    },
  },
});
