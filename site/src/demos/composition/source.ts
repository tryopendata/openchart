/**
 * Turns a dataset module's citation into a demo source, shared by the
 * comparison, tables and composition demo files.
 */
import type { DemoSource } from "../types";

/**
 * A dataset's citation as a figure source; the figure caption adds the "Source:" prefix.
 * A dataset with no URL (the illustrative ones) gives a label only.
 */
export function sourceOf(dataset: { source: string; url?: string }): DemoSource {
  const label = dataset.source.replace(/^Source:\s*/, "");
  return dataset.url ? { label, url: dataset.url } : { label };
}
