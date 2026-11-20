/**
 * Turns a dataset module's citation into a demo source. Every demo module that
 * cites a dataset from examples/src/data goes through this one function.
 */
import type { DemoSource } from "./types";

/** A dataset module's citation fields, as examples/src/data exports them. */
export type CitedDataset = { source: string; url?: string };

/**
 * A dataset's citation as a figure source, without the "Source:" prefix the
 * figure caption adds. A dataset with no URL gives a label only.
 */
export function sourceOf(dataset: CitedDataset): DemoSource {
  const label = dataset.source.replace(/^Source:\s*/, "");
  return dataset.url ? { label, url: dataset.url } : { label };
}
