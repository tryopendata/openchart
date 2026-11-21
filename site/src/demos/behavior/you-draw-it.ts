/**
 * Demos for the you-draw-it page (docs/behavior/you-draw-it). Each line hides
 * its data after `youDrawIt.from` until the reader draws a guess or presses
 * the reveal button. Both are `static: false`: a static render would draw the
 * hidden part of the line and give the answer away before any script runs.
 * Titles state only what the visible part of the line shows.
 */
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";
import { usInflation } from "@datasets/us-inflation";
import { sourceOf } from "../source";
import {
  largestGap,
  TEMPERATURE_ANOMALY_SUBTITLE,
  TEMPERATURE_AXIS_TITLE,
  TEMPERATURE_BASELINE,
} from "../style/temperature";
import { defineDemo } from "../types";

export const inflationGuess = defineDemo({
  id: "behavior/you-draw-it-inflation",
  title: "Draw US inflation from 2021",
  source: sourceOf(usInflation),
  height: 440,
  static: false,
  spec: {
    mark: { type: "line", strokeWidth: 2.5 },
    data: [...usInflation.data],
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        axis: { title: "Year-over-year change (%)", format: ".0f", grid: true },
      },
    },
    youDrawIt: {
      from: "2021-01-01",
      prompt: "Draw inflation through 2024",
      revealLabel: "Show the real rate",
    },
    chrome: {
      title: "US inflation stayed under 3% through 2019 and 2020",
      subtitle: "Consumer price index, year-over-year change, %, quarterly 2019–2024",
    },
  },
});

export const temperatureGuess = defineDemo({
  id: "behavior/you-draw-it-temperature",
  title: "Draw global temperature from 1970",
  source: sourceOf(gistempGlobalAnnual),
  height: 440,
  static: false,
  spec: {
    mark: { type: "line", strokeWidth: 2.5 },
    data: [...gistempGlobalAnnual.data],
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "anomaly",
        type: "quantitative",
        axis: {
          title: TEMPERATURE_AXIS_TITLE,
          format: "+.1f",
          grid: true,
        },
      },
    },
    youDrawIt: {
      from: "1970",
      prompt: "Draw the line to 2025",
      revealLabel: "Show the measurements",
    },
    chrome: {
      title: `From 1900 to 1970, no reading was more than ${largestGap("1900", "1970")}°C from the ${TEMPERATURE_BASELINE}`,
      subtitle: TEMPERATURE_ANOMALY_SUBTITLE,
    },
  },
});
