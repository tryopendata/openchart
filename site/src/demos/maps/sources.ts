/**
 * Source lines for map demos that draw geography: the dataset's own citation
 * followed by the atlas the shapes come from (us-atlas redistributes the Census
 * Bureau's cartographic boundaries, world-atlas redistributes Natural Earth).
 */
import { type CitedDataset, sourceOf } from "../source";
import type { DemoSource } from "../types";

/** The atlas each geography comes from, as it appears in a source line. */
const GEOGRAPHY_SOURCE = {
  us: "US Census Bureau via us-atlas",
  world: "Natural Earth via world-atlas",
} as const;

/** A dataset's citation followed by the atlas the map's shapes come from. */
export function sourceWithGeography(dataset: CitedDataset, geography: "us" | "world"): DemoSource {
  const { label, url } = sourceOf(dataset);
  const combined = `${label}; geography: ${GEOGRAPHY_SOURCE[geography]}`;
  return url ? { label: combined, url } : { label: combined };
}
