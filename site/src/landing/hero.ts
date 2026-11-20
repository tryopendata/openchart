/**
 * The hero desk's script: five cumulative specs that build one chart step by
 * step (mark and data, encoding, title with subtitle and source, one annotation,
 * the `broadsheet` preset). The chart is the World Bank's wealth and health
 * scatter, where the United States is the visible outlier the annotation names.
 * Each step only adds to the one before, so the lines it adds stay put in every
 * later step; `changed` comes from the same formatting the spec pane shows.
 */

import { wealthHealth } from "@datasets/wealth-health";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { broadsheet } from "@opendata-ai/openchart-core";
import { formatSpec, markAddedLines } from "../components/landing/hero/spec-lines";

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

/** The dataset's citation, for the figure caption. */
export const heroSource = { label: wealthHealth.source, url: wealthHealth.url };

const data = wealthHealth.data.map((row) => ({ ...row }));

const markAndData = {
  mark: "point",
  data,
  encoding: {
    x: { field: "gdpPerCapita", type: "quantitative" },
    y: { field: "lifeExpectancy", type: "quantitative" },
  },
} satisfies ChartSpec;

const encoding = {
  ...markAndData,
  encoding: {
    x: {
      ...markAndData.encoding.x,
      scale: { type: "log" },
      axis: { title: "GDP per person, US$ (log scale)", format: "$~s" },
    },
    y: { ...markAndData.encoding.y, axis: { title: "Life expectancy at birth, years" } },
    color: { field: "region", type: "nominal" },
    size: { field: "pop", type: "quantitative" },
  },
} satisfies ChartSpec;

const chrome = {
  ...encoding,
  chrome: {
    title: "Richer countries live longer. The United States is the exception",
    subtitle:
      "Life expectancy and GDP per person in 20 countries, 2022. Circle area shows population.",
    source: wealthHealth.source,
  },
} satisfies ChartSpec;

const annotation = {
  ...chrome,
  annotations: [
    {
      type: "text",
      x: 63544,
      y: 77.3,
      text: "**United States:** the richest here, yet shorter-lived than China",
      anchor: "bottom",
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
  const previous = index === 0 ? [] : formatSpec(STEP_SPECS[index - 1]?.spec ?? {});
  const added = markAddedLines(previous, formatSpec(step.spec));
  return { ...step, changed: added.filter((line) => line.added).map((line) => line.text) };
});
