/**
 * Demos for the field types and scales page (docs/the-spec/scales): ordinal
 * against temporal x on one series, zero and domain, and a log scale. The
 * sequential color example reuses the catalog heatmap.
 */
import { countryIndicators } from "@datasets/country-indicators";
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { degreesBetween, TEMPERATURE_BASELINE } from "../style/temperature";
import { defineDemo } from "../types";
import { ACCENT, ANOMALY_SUBTITLE } from "./shared";

const anomalyRows = gistempGlobalAnnual.data.map(({ year, anomaly }) => ({ year, anomaly }));
const anomalyY = {
  field: "anomaly",
  type: "quantitative",
  axis: { title: `Difference from the ${TEMPERATURE_BASELINE}`, format: "+.1f", labelSuffix: "°C" },
} as const;

/** The same rows on an ordinal and a temporal x; only the field type differs. */
const anomalyLine = (type: "ordinal" | "temporal"): ChartSpec => ({
  mark: { type: "line", stroke: ACCENT, strokeWidth: 2, point: true },
  data: anomalyRows,
  encoding: {
    x: { field: "year", type, ...(type === "temporal" ? { axis: { format: "%Y" } } : {}) },
    y: anomalyY,
  },
});

export const scalesOrdinal = defineDemo({
  id: "the-spec/scales-ordinal",
  title: "Temperature anomaly on an ordinal x axis",
  source: sourceOf(gistempGlobalAnnual),
  height: 400,
  spec: {
    ...anomalyLine("ordinal"),
    chrome: {
      title: "On an ordinal axis, the five years from 2020 to 2025 get as much width as a decade",
      subtitle: ANOMALY_SUBTITLE,
    },
  },
});

export const scalesTemporal = defineDemo({
  id: "the-spec/scales-temporal",
  title: "Temperature anomaly on a temporal x axis",
  source: sourceOf(gistempGlobalAnnual),
  height: 400,
  spec: {
    ...anomalyLine("temporal"),
    chrome: {
      title: `Global temperature rose ${degreesBetween("1970", "2025")}°C from 1970 to 2025`,
      subtitle: ANOMALY_SUBTITLE,
    },
  },
});

const lifeRows = countryIndicators.data.map(({ country, lifeExpectancy }) => ({
  country,
  lifeExpectancy,
}));

export const scalesDomain = defineDemo({
  id: "the-spec/scales-domain",
  title: "Life expectancy on an axis that starts at 65",
  source: sourceOf(countryIndicators),
  height: 480,
  spec: {
    // A point draws no stem from zero, so an axis that starts at 65 stays honest.
    // `trendline: false` stops a point mark fitting a line through the dots.
    mark: { type: "point", trendline: false, fill: ACCENT, size: 6 },
    data: lifeRows,
    encoding: {
      // A point mark thins category labels like numeric ticks; listing them keeps every country.
      y: {
        field: "country",
        type: "nominal",
        sort: "x",
        axis: { values: lifeRows.map((row) => row.country) },
      },
      x: {
        field: "lifeExpectancy",
        type: "quantitative",
        scale: { zero: false, domain: [65, 85] },
        axis: { title: "Life expectancy at birth (years)", grid: true },
      },
    },
    chrome: {
      title: "Life expectancy runs from 68.3 years in India to 83.6 in Japan",
      subtitle: "Life expectancy at birth in 12 large economies (years). The axis starts at 65.",
    },
  },
});

const populationRows = countryIndicators.data.map(({ country, population }) => ({
  country,
  population: population / 1_000_000,
}));

export const scalesLog = defineDemo({
  id: "the-spec/scales-log",
  title: "Population on a log scale",
  source: sourceOf(countryIndicators),
  height: 480,
  spec: {
    mark: { type: "circle", fill: ACCENT, size: 6 },
    data: populationRows,
    encoding: {
      y: { field: "country", type: "nominal", sort: "x" },
      x: {
        field: "population",
        type: "quantitative",
        scale: { type: "log", domain: [30, 1500], nice: false },
        axis: {
          title: "Population (millions, log scale)",
          format: ",.0f",
          values: [30, 100, 300, 1000],
          grid: true,
        },
      },
    },
    chrome: {
      title: "India has about 36 times as many people as Canada",
      subtitle:
        "Population of 12 large economies, 2023 (millions). Equal distances on the axis are equal ratios.",
    },
  },
});
