/**
 * Source lines for the map demos: the dataset's own citation, and for drawn
 * geography, the atlas the shapes come from (us-atlas redistributes the Census
 * Bureau's cartographic boundaries, world-atlas redistributes Natural Earth).
 */
import type { DemoSource } from "../types";

/** The atlas each geography comes from, as it appears in a source line. */
const GEOGRAPHY_SOURCE = {
  us: "US Census Bureau via us-atlas",
  world: "Natural Earth via world-atlas",
} as const;

/** A dataset module's citation fields, as examples/src/data exports them. */
type Cited = { source: string; url?: string };

/** A dataset's citation as a figure source; the figure caption adds the "Source:" prefix. */
export function sourceOf(dataset: Cited): DemoSource {
  const label = dataset.source.replace(/^Source:\s*/, "");
  return dataset.url ? { label, url: dataset.url } : { label };
}

/** A dataset's citation followed by the atlas the map's shapes come from. */
export function sourceWithGeography(dataset: Cited, geography: "us" | "world"): DemoSource {
  const { label, url } = sourceOf(dataset);
  const combined = `${label}; geography: ${GEOGRAPHY_SOURCE[geography]}`;
  return url ? { label: combined, url } : { label: combined };
}
