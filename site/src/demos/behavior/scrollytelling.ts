/**
 * Demos for the scrollytelling page (docs/behavior/scrollytelling). Each is a
 * story told as states: a base spec plus cumulative patches, merged the way
 * `createChartStory` merges its steps, so pressing a state button shows what
 * scrolling to that step would. Each takes its rows and citation from one
 * verified dataset module.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";
import { type ChartSpec, deepMergeSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import {
  anomalyIn,
  degreesBetween,
  readingCount,
  readingsAboveBaseline,
  signedDegrees,
  TEMPERATURE_BASELINE,
  warmSince,
} from "../style/temperature";
import { type DemoState, defineDemo } from "../types";

/** One story step: its button label and the patch it adds, as `createChartStory` takes it. */
type StoryStep = { label: string; patch: Record<string, unknown> };

/** Each step's full spec: the base with every patch up to and including that step merged in. */
function storyStates(base: ChartSpec, steps: readonly StoryStep[]): DemoState[] {
  let spec = base;
  return steps.map(({ label, patch }) => {
    spec = deepMergeSpec(spec, patch) as ChartSpec;
    return { label, spec };
  });
}

const temperatureBase: ChartSpec = {
  mark: "bar",
  data: gistempGlobalAnnual.data.map((row) => ({ ...row })),
  encoding: {
    x: { field: "year", type: "ordinal" },
    y: {
      field: "anomaly",
      type: "quantitative",
      axis: { title: `Difference from ${TEMPERATURE_BASELINE} (°C)`, format: "+.1f" },
    },
    color: {
      field: "trend",
      type: "nominal",
      scale: { domain: ["Cooler", "Warmer"], range: ["#3b82c4", "#d1495b"] },
    },
  },
  labels: { density: "none" },
  annotations: [{ type: "refline", y: 0, style: "solid", strokeWidth: 1 }],
  chrome: {
    title: `Every reading since ${warmSince} is above the ${TEMPERATURE_BASELINE}`,
    subtitle: `Global surface temperature, difference from the ${TEMPERATURE_BASELINE}, 1900 to 2025 (°C)`,
  },
};

// Arrays replace rather than merge, so each step restates the annotations before it.
const zeroLine = { type: "refline", y: 0, style: "solid", strokeWidth: 1 } as const;
const since1980 = {
  type: "range",
  x1: "1980",
  x2: "2025",
  label: "Since 1980",
  labelAnchor: "top",
} as const;
const latestReading = {
  type: "text",
  x: "2025",
  y: anomalyIn("2025"),
  text: signedDegrees(anomalyIn("2025")),
  anchor: "top",
  offset: { dx: 0, dy: -8 },
} as const;

export const temperatureStory = defineDemo({
  id: "behavior/story-temperature",
  title: "Global temperature anomaly, told in four steps",
  source: sourceOf(gistempGlobalAnnual),
  caption: "Each button shows the chart at one step of the story.",
  height: 460,
  spec: temperatureBase,
  controls: {
    states: {
      initialLabel: "1900 to 2025",
      others: storyStates(temperatureBase, [
        {
          label: "Since 1980",
          patch: {
            annotations: [zeroLine, since1980],
            chrome: {
              title: `Global temperature rose ${degreesBetween("1980", "2025")}°C from 1980 to 2025`,
            },
          },
        },
        {
          label: "Latest reading",
          patch: {
            annotations: [zeroLine, since1980, latestReading],
            chrome: {
              title: `The 2025 reading was ${anomalyIn("2025")}°C above the ${TEMPERATURE_BASELINE}`,
            },
          },
        },
        {
          label: "Warmer readings",
          patch: {
            encoding: { color: { highlight: ["Warmer"] } },
            chrome: {
              title: `Of the ${readingCount} readings, ${readingsAboveBaseline} are above the ${TEMPERATURE_BASELINE}`,
            },
          },
        },
      ]),
    },
  },
});

const electricityBase: ChartSpec = {
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
    title: "Gas and coal made more than half of generation from the six main sources every year",
    subtitle:
      "Share of US generation from coal, gas, nuclear, hydro, wind and solar, 2016 to 2023 (%)",
  },
};

export const electricityStory = defineDemo({
  id: "behavior/story-electricity",
  title: "US electricity generation by source, told in highlights",
  source: sourceOf(electricityMixMatrix),
  caption: "Each button highlights the sources one step of the story is about.",
  height: 460,
  spec: electricityBase,
  controls: {
    states: {
      initialLabel: "All sources",
      others: storyStates(electricityBase, [
        {
          label: "Coal",
          patch: {
            encoding: { color: { highlight: ["Coal"] } },
            chrome: { title: "Coal's share fell from 31.2% in 2016 to 16.2% in 2023" },
          },
        },
        {
          label: "Gas",
          patch: {
            encoding: { color: { highlight: ["Gas"] } },
            chrome: { title: "Gas's share rose from 34.8% in 2016 to 43.5% in 2023" },
          },
        },
        {
          label: "Wind and solar",
          patch: {
            encoding: { color: { highlight: ["Wind", "Solar"] } },
            chrome: {
              title: "Wind and solar's combined share rose from 7.1% in 2016 to 15.9% in 2023",
            },
          },
        },
      ]),
    },
  },
});
