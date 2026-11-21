/**
 * The hero desk's script: five cumulative specs that build one chart step by
 * step: the plotted data, the headline and source, the axis label, one
 * annotation, the `broadsheet` preset. The chart is life expectancy by sex in
 * twelve countries (UN World Population Prospects 2024) as a dumbbell, rows
 * ordered by the gap between the sexes, with Russia's ten-year gap called out.
 * Each step only adds to the one before, so the lines it adds stay put in every
 * later step; `changed` comes from the same formatting the spec pane shows.
 */

import { lifeExpectancyGender } from "@datasets/life-expectancy-gender";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { broadsheet } from "@opendata-ai/openchart-core";
import { sourceOf } from "../demos/source";
import { formatSpec, markAddedLines, type SpecFolds } from "./spec-lines";

/** One step of the hero desk. */
export type HeroStep = {
  /** Stable id, unique across the steps. */
  id: string;
  /** The step's name in the step list: what the reader sees happen to the graphic. */
  label: string;
  /** One plain sentence under the steps saying what this step changed in the graphic. */
  caption: string;
  /** The single most telling line this step adds, shown as a teaser while the spec is closed. One of `changed`. */
  teaser: string;
  /** The whole spec as of this step, data inline. Every step's spec passes `validateSpec`. */
  spec: ChartSpec;
  /**
   * The spec lines this step adds, as the spec pane shows them with surrounding
   * whitespace trimmed. The pane marks these lines with `data-spec-added`.
   */
  changed: string[];
};

/** The dataset's citation for the figure caption, which writes "Source:" itself. */
export const heroSource = sourceOf(lifeExpectancyGender);

/** The pane folds the preset to one line, as it folds the data rows. */
export const heroFolds: SpecFolds = { theme: "broadsheet preset" };

const data = lifeExpectancyGender.data.map((row) => ({ ...row }));

/** The gap in years between the two sexes in one country. */
function gapIn(country: string): number {
  const years = data.filter((row) => row.country === country).map((row) => row.years);
  return Math.max(...years) - Math.min(...years);
}

/**
 * Countries by gap, smallest first: the engine draws a nominal y in sort order
 * from the bottom up, so this puts the widest gap (Russia) at the top.
 */
const byGap = [...new Set(data.map((row) => row.country))].sort((a, b) => gapIn(a) - gapIn(b));

/**
 * Step 1 is already the finished picture's skeleton: the same x domain and row
 * order as the last step, and colour by sex, which is what makes the library
 * draw a dumbbell (without it, the dot mark draws stems from the axis). Each
 * later step adds one thing to that picture.
 */
const plotted = {
  mark: "circle",
  data,
  encoding: {
    x: { field: "years", type: "quantitative", scale: { domain: [65, 90] } },
    y: { field: "country", type: "nominal", sort: byGap },
    color: { field: "gender", type: "nominal" },
  },
} satisfies ChartSpec;

const headline = {
  ...plotted,
  chrome: {
    title: "Women outlive men in every country here, and by ten years in Russia",
    subtitle: "Life expectancy at birth by sex, 2023, years",
    source: lifeExpectancyGender.source,
  },
} satisfies ChartSpec;

const axisLabel = {
  ...headline,
  encoding: {
    ...headline.encoding,
    x: { ...headline.encoding.x, axis: { title: "Life expectancy at birth, years" } },
  },
} satisfies ChartSpec;

const annotation = {
  ...axisLabel,
  annotations: [
    {
      type: "text",
      // Russia's female value: the label sits on Russia's row, just past its dot.
      x: 78.2,
      y: "Russia",
      text: "Russia: 10 years",
      anchor: "right",
      offset: { dx: 6, dy: 0 },
      connector: false,
      dot: false,
      fontWeight: 600,
    },
  ],
} satisfies ChartSpec;

const preset = { ...annotation, theme: broadsheet } satisfies ChartSpec;

type StepScript = { id: string; label: string; caption: string; teaser: string; spec: ChartSpec };

const STEP_SPECS: StepScript[] = [
  {
    id: "plot",
    label: "Plot the data",
    caption: "Men and women in each country, joined by a line, the widest gap at the top.",
    teaser: '"mark": "circle",',
    spec: plotted,
  },
  {
    id: "headline",
    label: "Add the headline and source",
    caption: "A headline states the finding; the deck and source line say what and from where.",
    teaser: '"title": "Women outlive men in every country here, and by ten years in Russia",',
    spec: headline,
  },
  {
    id: "axis",
    label: "Label the axis",
    caption: "The axis says what its numbers are: years of life expected at birth.",
    teaser: '"axis": { "title": "Life expectancy at birth, years" }',
    spec: axisLabel,
  },
  {
    id: "annotation",
    label: "Call out the outlier",
    caption: "A label on Russia's row marks the widest gap between the sexes.",
    teaser: '"text": "Russia: 10 years",',
    spec: annotation,
  },
  {
    id: "preset",
    label: "Set it in the house style",
    caption: "The broadsheet preset sets the type, the paper and the red rule over the headline.",
    teaser: '"theme": { … broadsheet preset }',
    spec: preset,
  },
];

/** The five steps, in order. The last is the finished chart, shown before hydration and under reduced motion. */
export const heroSteps: HeroStep[] = STEP_SPECS.map((step, index) => {
  const before = STEP_SPECS[index - 1];
  const previous = before ? formatSpec(before.spec, heroFolds) : [];
  const added = markAddedLines(previous, formatSpec(step.spec, heroFolds));
  return { ...step, changed: added.filter((line) => line.added).map((line) => line.text) };
});
