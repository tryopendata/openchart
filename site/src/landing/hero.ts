/**
 * The hero desk's script: five cumulative specs that build one chart step by
 * step (mark and data, encoding, title with subtitle and source, one annotation,
 * the `broadsheet` preset). Lane 2/a fills it; the scaffold fixes the shape.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";

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

/** The five steps, in order. The last is the finished chart, shown before hydration and under reduced motion. */
export const heroSteps: HeroStep[] = [];
