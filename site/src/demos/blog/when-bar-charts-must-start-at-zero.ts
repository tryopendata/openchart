/**
 * The figures in the blog post "When bar charts must start at zero": a truncated horizontal bar chart of the eight countries under
 * 1 billion people, the same bars anchored at zero, and a zoomed line chart of
 * US CPI inflation. Titles are computed from the dataset rows so they cannot
 * drift, and a test pins the post's `json demo` fence to `baselineBarsZero`.
 */
import { populationByCountry } from "@datasets/population";
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec, ChartSpecOverride } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { ACCENT } from "../the-spec/shared";
import { defineDemo } from "../types";

const BILLION = 1_000_000_000;
const TRUNCATED_MIN = 100_000_000;
const BAR_MAX = 360_000_000;

const underOneBillion = populationByCountry.data.filter((row) => row.population < BILLION);
const populationSource = sourceOf(populationByCountry);

const indonesia = underOneBillion.find((row) => row.country === "Indonesia");
const ethiopia = underOneBillion.find((row) => row.country === "Ethiopia");
if (!indonesia || !ethiopia) {
  throw new Error("Expected Indonesia and Ethiopia in populationByCountry");
}

const formatMillions = (value: number) => `${Math.round(value / 1_000_000)}M`;
const truncatedRatio = (
  (indonesia.population - TRUNCATED_MIN) /
  (ethiopia.population - TRUNCATED_MIN)
).toFixed(1);
const trueRatio = (indonesia.population / ethiopia.population).toFixed(1);

const populationBarsBase = (domain: [number, number]): ChartSpec => ({
  mark: "bar",
  data: underOneBillion.map((row) => ({ ...row })),
  encoding: {
    x: {
      field: "population",
      type: "quantitative",
      scale: { domain },
      axis: { title: "Population", format: ".2~s" },
    },
    y: { field: "country", type: "nominal", sort: "x" },
  },
});

export const baselineBarsTruncated = defineDemo({
  id: "blog/baseline-bars-truncated",
  title: "Population of eight countries with a truncated 100M baseline",
  source: populationSource,
  height: 400,
  spec: {
    ...populationBarsBase([TRUNCATED_MIN, BAR_MAX]),
    chrome: {
      title: `Starting at ${formatMillions(TRUNCATED_MIN)} makes ${indonesia.country}'s bar ${truncatedRatio}x ${ethiopia.country}'s instead of ${trueRatio}x`,
      subtitle:
        "Population of the eight countries under 1 billion, 2025 estimates (axis starts at 100M)",
    },
  },
});

/**
 * Phone widths (compact and medium breakpoints) drop the parenthetical
 * populations from the title, and pin a tick every 100M because the engine
 * otherwise thins this axis to 0 and 200M, unlike the truncated chart above.
 */
const zeroBarsOnPhones: ChartSpecOverride = {
  encoding: { x: { axis: { values: [0, 100_000_000, 200_000_000, 300_000_000] } } },
  chrome: {
    title: `${indonesia.country}'s population is ${trueRatio}x ${ethiopia.country}'s`,
  },
};

export const baselineBarsZero = defineDemo({
  id: "blog/baseline-bars-zero",
  title: "Population of eight countries with a zero baseline",
  source: populationSource,
  height: 400,
  spec: {
    ...populationBarsBase([0, BAR_MAX]),
    chrome: {
      title: `${indonesia.country}'s population is ${trueRatio}x ${ethiopia.country}'s (${formatMillions(indonesia.population)} vs ${formatMillions(ethiopia.population)})`,
      subtitle: "Population of the eight countries under 1 billion, 2025 estimates",
    },
    overrides: { compact: zeroBarsOnPhones, medium: zeroBarsOnPhones },
  },
});

const recentInflation = usInflation.data.filter(
  (row) => row.date >= "2021-04-01" && row.date <= "2024-10-01",
);
const inflationSource = sourceOf(usInflation);
const peakInflation = recentInflation.reduce((high, row) => (row.rate > high.rate ? row : high));
const latestInflation = recentInflation.at(-1);
if (!latestInflation) {
  throw new Error("Expected quarterly observations in recentInflation");
}

export const baselineLineZoomed = defineDemo({
  id: "blog/baseline-line-zoomed",
  title: "US CPI inflation from 2021 to 2024 on a non-zero y-axis",
  source: inflationSource,
  height: 400,
  spec: {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2, point: true },
    data: recentInflation.map((row) => ({ ...row })),
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%b '%y", tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        scale: { zero: false },
        axis: { title: "CPI (year-over-year %)", format: ".1f", labelSuffix: "%", grid: true },
      },
    },
    chrome: {
      title: `US inflation peaked at ${peakInflation.rate.toFixed(1)}% in ${peakInflation.date.slice(0, 4)} and eased to ${latestInflation.rate.toFixed(1)}% by late ${latestInflation.date.slice(0, 4)}`,
      subtitle: "US consumer price index, year-over-year % change, quarterly Q2 2021 to Q4 2024",
    },
  },
});
