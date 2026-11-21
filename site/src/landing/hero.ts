/**
 * The hero desk's script: five cumulative specs that build one chart step by
 * step (mark and data, encoding, title with subtitle and source, one annotation,
 * the `broadsheet` preset). The chart is life expectancy by sex in twelve
 * countries (UN World Population Prospects 2024): plain dots at first, then a
 * dumbbell once color splits the sexes, with Russia's ten-year gap called out.
 * Each step only adds to the one before, so the lines it adds stay put in every
 * later step; `changed` comes from the same formatting the spec pane shows.
 */

import { lifeExpectancyGender } from "@datasets/life-expectancy-gender";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { broadsheet } from "@opendata-ai/openchart-core";
import { formatSpec, markAddedLines, type SpecFolds } from "./spec-lines";

/** One step of the hero desk. */
export type HeroStep = {
  /** Stable id, unique across the steps. */
  id: string;
  /** The step's name in the step list. */
  label: string;
  /** The whole spec as of this step, data inline. Every step's spec passes `validateSpec`. */
  spec: ChartSpec;
  /**
   * The spec lines this step adds, as the spec pane shows them with surrounding
   * whitespace trimmed. The pane marks these lines with `data-spec-added`.
   */
  changed: string[];
};

/** The dataset's citation for the figure caption, which writes "Source:" itself. */
export const heroSource = {
  label: lifeExpectancyGender.source.replace(/^Source:\s*/, ""),
  url: lifeExpectancyGender.url,
};

/** The pane folds the preset to one line, as it folds the data rows. */
export const heroFolds: SpecFolds = { theme: "broadsheet preset" };

const data = lifeExpectancyGender.data.map((row) => ({ ...row }));

const markAndData = {
  mark: "circle",
  data,
  encoding: {
    x: { field: "years", type: "quantitative" },
    y: { field: "country", type: "nominal" },
  },
} satisfies ChartSpec;

const encoding = {
  ...markAndData,
  encoding: {
    x: {
      ...markAndData.encoding.x,
      scale: { domain: [65, 90] },
      axis: { title: "Life expectancy at birth, years" },
    },
    y: { ...markAndData.encoding.y, sort: "-x" },
    color: { field: "gender", type: "nominal" },
  },
} satisfies ChartSpec;

const chrome = {
  ...encoding,
  chrome: {
    title: "Women outlive men in every country here, and by ten years in Russia",
    subtitle: "Life expectancy at birth by sex, 2023, years",
    source: lifeExpectancyGender.source,
  },
} satisfies ChartSpec;

const annotation = {
  ...chrome,
  annotations: [
    {
      type: "text",
      // Russia's female value: the label sits beside the end of its bar.
      x: 78.2,
      y: "Russia",
      text: "Russia: 10 years",
      anchor: "right",
      connector: false,
      dot: false,
      fontWeight: 600,
    },
  ],
} satisfies ChartSpec;

const preset = { ...annotation, theme: broadsheet } satisfies ChartSpec;

const STEP_SPECS: { id: string; label: string; spec: ChartSpec }[] = [
  { id: "mark", label: "Mark and data", spec: markAndData },
  { id: "encoding", label: "Encoding", spec: encoding },
  { id: "chrome", label: "Title and source", spec: chrome },
  { id: "annotation", label: "Annotation", spec: annotation },
  { id: "preset", label: "Broadsheet preset", spec: preset },
];

/** The five steps, in order. The last is the finished chart, shown before hydration and under reduced motion. */
export const heroSteps: HeroStep[] = STEP_SPECS.map((step, index) => {
  const before = STEP_SPECS[index - 1];
  const previous = before ? formatSpec(before.spec, heroFolds) : [];
  const added = markAddedLines(previous, formatSpec(step.spec, heroFolds));
  return { ...step, changed: added.filter((line) => line.added).map((line) => line.text) };
});
