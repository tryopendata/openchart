/**
 * The wall's specs as one JSON document, served as a static asset that the page
 * fetches only when its first tile mounts, so the HTML carries no specs. Large
 * values the tiles share, such as a US atlas, are written once: each spec holds
 * `null` at that place and a reference, the same way demo figures share values
 * on a page (lib/demo/shared-values.ts).
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { getDemo } from "../../../demos/registry";
import type { DemoSharedRef } from "../../../lib/demo/markup";
import { splitSharedValues } from "../../../lib/demo/shared-values";
import { validateDemo } from "../../../lib/demo/validate";
import type { VocabularyTile } from "../../../landing/vocabulary";
import { tileSpec } from "./tile-spec";

/** Where the page fetches the document (src/pages/vocabulary-wall.json.ts serves it). */
export const WALL_SPECS_URL = "/vocabulary-wall.json";

/** The document: each tile's spec with its shared values left out, and those values by hash. */
export type WallSpecsDocument = {
  specs: Record<string, { spec: unknown; refs: DemoSharedRef[] }>;
  shared: Record<string, unknown>;
};

/**
 * A tile's demo and the spec the tile draws, checked.
 *
 * @throws {Error} Naming the tile when its demo is unknown or its spec fails validation.
 */
export function wallTileDemo(tile: VocabularyTile): { title: string; spec: VizSpec } {
  try {
    const demo = getDemo(tile.demo);
    validateDemo(tile.demo, demo.spec);
    return { title: demo.title, spec: tileSpec(demo.spec) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`src/landing/vocabulary.ts tile "${tile.demo}": ${reason}`, { cause: error });
  }
}

/** Builds the document for the given tiles. */
export function wallSpecsDocument(tiles: readonly VocabularyTile[]): WallSpecsDocument {
  const written = new Set<string>();
  const document: WallSpecsDocument = { specs: {}, shared: {} };
  for (const tile of tiles) {
    const { specJson, refs, values } = splitSharedValues(wallTileDemo(tile).spec, written);
    document.specs[tile.demo] = { spec: JSON.parse(specJson), refs };
    for (const { hash, json } of values) document.shared[hash] = JSON.parse(json);
  }
  return document;
}
