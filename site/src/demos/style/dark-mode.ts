/**
 * Demos for the dark mode page (docs/style/dark-mode). The first chart uses
 * the site theme and redraws with the header toggle like every figure on the
 * site. The other two set `pageTheme: false`: one shows the broadsheet preset's
 * dark palette, one a custom theme written as light and dark color pairs.
 */
import { populationByCountry } from "@datasets/population";
import { temperatureAnomaly } from "@datasets/temperature-anomaly";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { broadsheet } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

// In millions, so labels read "1,463" rather than the SI "1.46G".
const populationMillions = populationByCountry.data.map((row) => ({
  country: row.country,
  millions: row.population / 1_000_000,
}));

const populationSpec: ChartSpec = {
  mark: "bar",
  data: populationMillions,
  encoding: {
    x: {
      field: "millions",
      type: "quantitative",
      axis: { title: "Population (millions)", format: ",.0f" },
    },
    y: { field: "country", type: "nominal", sort: "x" },
  },
  labels: { format: ",.0f" },
  chrome: {
    title: "India and China each have more than four times as many people as the United States",
    subtitle: "Population of the ten most populous countries, 2025 projection",
  },
};

export const siteDarkMode = defineDemo({
  id: "style/dark-mode-site",
  title: "Population of the ten most populous countries",
  source: sourceOf(populationByCountry),
  height: 440,
  spec: populationSpec,
});

export const presetDarkMode = defineDemo({
  id: "style/dark-mode-preset",
  title: "Population in the broadsheet preset",
  source: sourceOf(populationByCountry),
  height: 460,
  pageTheme: false,
  spec: { ...populationSpec, theme: broadsheet },
});

export const pairedDarkMode = defineDemo({
  id: "style/dark-mode-pairs",
  title: "Global temperature anomaly in a theme of color pairs",
  source: sourceOf(temperatureAnomaly),
  height: 440,
  pageTheme: false,
  spec: {
    mark: "bar",
    data: [...temperatureAnomaly.data],
    encoding: {
      x: { field: "year", type: "ordinal", axis: { title: "Decade" } },
      y: {
        field: "anomaly",
        type: "quantitative",
        axis: { title: "Difference from the 20th-century average (°C)", format: "+.1f" },
      },
      color: { field: "trend", type: "nominal", scale: { domain: ["Cooler", "Warmer"] } },
    },
    labels: { density: "none" },
    annotations: [{ type: "refline", y: 0, style: "solid", strokeWidth: 1 }],
    theme: {
      colors: {
        categorical: [
          { light: "#1d5f8a", dark: "#7fb0d3" },
          { light: "#c2410c", dark: "#fb923c" },
        ],
        background: { light: "#fff8ef", dark: "#17130f" },
        text: { light: "#2b2118", dark: "#f3e9dc" },
        axis: { light: "#76695b", dark: "#b3a493" },
      },
    },
    chrome: {
      title:
        "Global temperature has been above the 20th-century average in every reading since 1960",
      subtitle: "Global surface temperature anomaly, °C, each decade from 1900 and 2025",
    },
  },
});
