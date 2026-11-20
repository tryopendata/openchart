/** Turns a spec into runnable code for each supported framework. */
import type { VizSpec } from "@opendata-ai/openchart-core";

export type FrameworkSnippets = { react: string; vue: string; svelte: string; vanilla: string };

/** Complete, runnable code that renders this spec in each framework. */
export function frameworkSnippets(_spec: VizSpec): FrameworkSnippets {
  throw new Error("not implemented");
}
