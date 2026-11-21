/**
 * What the HeroDesk island receives for each step: the label, caption and
 * teaser line, the spec for the live chart, and the spec pane's lines already formatted and marked at build
 * time. Formatting here keeps the hero's step module (and the core library it
 * imports for the preset) out of the island's bundle.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import type { HeroStep } from "../../../landing/hero";
import {
  formatSpec,
  type MarkedSpecLine,
  markAddedLines,
  type SpecFolds,
} from "../../../landing/spec-lines";

/** One step as the island renders it. */
export type DeskStep = {
  id: string;
  label: string;
  caption: string;
  teaser: string;
  spec: ChartSpec;
  lines: MarkedSpecLine[];
};

/** The island's steps: each step's lines marked against the step before it. */
export function toDeskSteps(steps: readonly HeroStep[], folds: SpecFolds): DeskStep[] {
  return steps.map((step, index) => {
    const previous = steps[index - 1];
    return {
      id: step.id,
      label: step.label,
      caption: step.caption,
      teaser: step.teaser,
      spec: structuredClone(step.spec),
      lines: markAddedLines(
        previous ? formatSpec(previous.spec, folds) : [],
        formatSpec(step.spec, folds),
      ),
    };
  });
}
