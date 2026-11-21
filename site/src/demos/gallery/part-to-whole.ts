/**
 * The gallery's part-to-whole graphics, on the US generation mix
 * (`electricity-mix-matrix`): 2023 as a donut and as a waffle, and every year
 * from 2016 to 2023 stacked to 100%. Ported from the Ladle pie and donut, and
 * bar and column galleries, rebuilt on this tier-1 dataset.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { combinedShare, MIX_MEASURE, mixIn, mixRows, SOURCES, shareOf } from "./shared";

const LATEST = "2023";
const FIRST = "2016";
const RENEWABLES = ["Wind", "Solar"] as const;
const RENEWABLE_SET = new Set<string>(RENEWABLES);

export const electricityDonut = defineDemo({
  id: "gallery/electricity-donut",
  title: "US generation mix, 2023",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: {
      type: "arc",
      innerRadius: 64,
      centerLabel: { text: `${shareOf("Gas", LATEST)}%`, subtitle: "gas" },
    },
    data: mixIn(LATEST),
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: { field: "source", type: "nominal", scale: { domain: [...SOURCES] } },
    },
    chrome: {
      title: "Gas generated more than coal and nuclear combined in 2023",
      subtitle: `${MIX_MEASURE}, ${LATEST} (%)`,
    },
  },
});

export const electricityWaffle = defineDemo({
  id: "gallery/electricity-waffle",
  title: "US generation mix in 100 squares, 2023",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: "waffle",
    data: mixIn(LATEST),
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: {
        field: "source",
        type: "nominal",
        scale: { domain: [...SOURCES] },
        highlight: ["Nuclear", ...RENEWABLES],
      },
    },
    chrome: {
      title: "Nuclear generated more than wind and solar together in 2023",
      subtitle: `${MIX_MEASURE}, ${LATEST}. Each square is one percent; shares round to whole squares.`,
    },
  },
});

export const electricityShareColumns = defineDemo({
  id: "gallery/electricity-share-columns",
  title: "US generation mix by year, 2016 to 2023",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: "bar",
    // Segments stack in row order, so wind and solar's rows come first to sit on the baseline.
    data: [...mixRows].sort(
      (a, b) => Number(!RENEWABLE_SET.has(a.source)) - Number(!RENEWABLE_SET.has(b.source)),
    ),
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "share",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of generation", format: ".0%", grid: true },
      },
      color: {
        field: "source",
        type: "nominal",
        scale: { domain: [...RENEWABLES, "Hydro", "Nuclear", "Gas", "Coal"] },
        highlight: [...RENEWABLES],
      },
    },
    labels: false,
    chrome: {
      title: `Wind and solar's combined share more than doubled from ${FIRST} to ${LATEST}, to ${combinedShare(RENEWABLES, LATEST)}%`,
      subtitle: `${MIX_MEASURE}, each year stacked to 100%`,
    },
  },
});
