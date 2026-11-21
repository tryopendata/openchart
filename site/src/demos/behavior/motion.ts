/**
 * Demos for the motion page (docs/behavior/motion): a data update that tweens,
 * the animation presets with Replay, and a line entrance with Replay. Each
 * takes its rows and citation from one verified dataset module.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { populationByCountry } from "@datasets/population";
import { usInflation } from "@datasets/us-inflation";
import type { AnimationSpec, ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const inflationRows = usInflation.data.map((row) => ({ ...row }));
const inflationThrough2021 = inflationRows.filter((row) => row.date < "2022-01-01");

/** The quarterly inflation line for one stretch of years, titled with what that stretch shows. */
function inflationLine(
  rows: readonly { date: string; rate: number }[],
  title: string,
  years: string,
): ChartSpec {
  return {
    mark: { type: "line", strokeWidth: 2 },
    data: rows.map((row) => ({ ...row })),
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        axis: { title: "Inflation (%)", format: ".0f", grid: true },
      },
    },
    chrome: {
      title,
      subtitle: `US consumer prices, change from a year earlier, quarterly, ${years} (%)`,
    },
  };
}

export const inflationUpdate = defineDemo({
  id: "behavior/motion-update",
  title: "US inflation, 2019 to 2021 and 2019 to 2024",
  source: sourceOf(usInflation),
  height: 420,
  spec: inflationLine(
    inflationThrough2021,
    "US inflation reached 6.2% by the end of 2021",
    "2019 to 2021",
  ),
  controls: {
    states: {
      initialLabel: "2019 to 2021",
      others: [
        {
          label: "2019 to 2024",
          spec: inflationLine(
            inflationRows,
            "US inflation peaked at 8.5% in 2022 and was down to 2.6% by late 2024",
            "2019 to 2024",
          ),
        },
      ],
    },
  },
});

/** The ten most populous countries as labelled bars, moving as `animation` says. */
function populationBars(animation?: AnimationSpec): ChartSpec {
  return {
    mark: "bar",
    data: populationByCountry.data.map((row) => ({ ...row })),
    encoding: {
      y: { field: "country", type: "nominal", sort: "x" },
      x: {
        field: "population",
        type: "quantitative",
        axis: { title: "Population", format: ".2s" },
      },
    },
    labels: { density: "all", format: ".3s" },
    chrome: {
      title: "India and China each have more than 1.4 billion people",
      subtitle: "Population of the 10 most populous countries, 2025, UN projection",
    },
    ...(animation === undefined ? {} : { animation }),
  };
}

export const presetBars = defineDemo({
  id: "behavior/motion-presets",
  title: "Population of the 10 most populous countries",
  source: sourceOf(populationByCountry),
  caption: "Choose a setting, then press Replay to play the entrance with it.",
  height: 440,
  spec: populationBars(),
  controls: {
    states: {
      initialLabel: "Default",
      others: [
        { label: "Fluid", spec: populationBars("fluid") },
        { label: "Subtle", spec: populationBars("subtle") },
        { label: "Off", spec: populationBars(false) },
      ],
    },
    replay: true,
  },
});

export const electricityLines = defineDemo({
  id: "behavior/motion-replay",
  title: "US electricity generation by source",
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
        axis: { title: "Share of generation (%)", grid: true },
      },
      color: { field: "source", type: "nominal" },
    },
    endpointLabels: true,
    chrome: {
      title: "Coal's share of US electricity fell from 31% to 16% between 2016 and 2023",
      subtitle: "Share of US generation from six sources, 2016 to 2023 (%)",
    },
  },
  controls: { replay: true },
});
