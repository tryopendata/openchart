/**
 * The hero's steps on their way to the HeroDesk island. The page passes each
 * step's words and spec (`deskSources`) and the island formats the spec pane's
 * lines itself (`toDeskSteps`), since the lines are several times the size of
 * the specs they come from and would otherwise be written into the page's HTML
 * as island props. Only types come from the hero's step module, so the core
 * library it imports for the preset stays out of the island's bundle.
 */
import type { HeroStep } from "../../../landing/hero";
import {
  formatSpec,
  type MarkedSpecLine,
  markAddedLines,
  type SpecFolds,
} from "../../../landing/spec-lines";

/** What the page passes the island for each step: its words and its spec. */
export type DeskStepSource = Pick<HeroStep, "id" | "label" | "caption" | "teaser" | "spec">;

/** One step as the island renders it: its source and the spec pane's marked lines. */
export type DeskStep = DeskStepSource & { lines: MarkedSpecLine[] };

/** The steps as the page passes them, without the fields only the build reads. */
export function deskSources(steps: readonly HeroStep[]): DeskStepSource[] {
  return steps.map(({ id, label, caption, teaser, spec }) => ({
    id,
    label,
    caption,
    teaser,
    spec: structuredClone(spec),
  }));
}

/** The island's steps: each step's lines marked against the step before it. */
export function toDeskSteps(steps: readonly DeskStepSource[], folds: SpecFolds): DeskStep[] {
  return steps.map((step, index) => {
    const previous = steps[index - 1];
    return {
      ...step,
      lines: markAddedLines(
        previous ? formatSpec(previous.spec, folds) : [],
        formatSpec(step.spec, folds),
      ),
    };
  });
}
