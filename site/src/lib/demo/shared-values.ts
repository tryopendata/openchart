/**
 * Moves the large values out of a demo's embedded spec so a page carries each
 * one once. A bulky value (see fold-targets.ts) over SHARED_MIN_CHARS of JSON is
 * keyed by a hash of its JSON; the first figure on a page to use a hash writes
 * the block, and every figure that uses it holds `null` in its place and a
 * `DemoSharedRef` the mount script resolves (markup.ts describes the markup).
 * The per-page record of written hashes is keyed by the page's `Astro.locals`,
 * which Astro creates fresh for each page it renders, static builds included.
 */
import { createHash } from "node:crypto";
import type { VizSpec } from "@opendata-ai/openchart-core";
import { foldTargets } from "./fold-targets";
import type { DemoSharedRef, SpecPath } from "./markup";

/**
 * Values shorter than this as JSON stay in the spec. A reference and its block
 * cost about 200 bytes, and a figure cannot know whether a later one on the page
 * will share its value, so only values well past that move out. A US state
 * atlas is about 15 KB, so several US maps on one page share one block.
 */
const SHARED_MIN_CHARS = 4_000;

/** One value a figure writes as a shared block: its hash and its JSON. */
export type SharedValue = { hash: string; json: string };

/** A spec split for embedding: its JSON with shared values left out, the references, and new blocks. */
export type SharedSplit = { specJson: string; refs: DemoSharedRef[]; values: SharedValue[] };

const writtenByPage = new WeakMap<object, Set<string>>();

/**
 * The hashes of the shared values already written on one page.
 *
 * @param page An object unique to the page's render, such as `Astro.locals`.
 */
export function pageSharedHashes(page: object): Set<string> {
  let written = writtenByPage.get(page);
  if (!written) {
    written = new Set();
    writtenByPage.set(page, written);
  }
  return written;
}

/** A copy of `root` with `null` at the path; only the containers along the path are copied. */
function withNullAt(root: unknown, path: SpecPath): unknown {
  const [key, ...rest] = path;
  if (key === undefined) return null;
  const copy = (Array.isArray(root) ? [...root] : { ...(root as object) }) as Record<
    string | number,
    unknown
  >;
  copy[key] = withNullAt(copy[key], rest);
  return copy;
}

const hashOf = (json: string) => createHash("sha256").update(json).digest("hex").slice(0, 16);

/**
 * Splits the spec's large values out. Hashes not yet in `written` are added to
 * it and come back in `values`, for this figure to write.
 *
 * @throws {FoldMarkerError} When the spec contains the text fold markers use.
 */
export function splitSharedValues(spec: VizSpec, written: Set<string>): SharedSplit {
  let embedded: unknown = spec;
  const refs: DemoSharedRef[] = [];
  const values: SharedValue[] = [];
  for (const { path, value } of foldTargets(spec)) {
    const json = JSON.stringify(value);
    if (json.length < SHARED_MIN_CHARS) continue;
    const hash = hashOf(json);
    embedded = withNullAt(embedded, path);
    refs.push({ path, hash });
    if (written.has(hash)) continue;
    written.add(hash);
    values.push({ hash, json });
  }
  return { specJson: JSON.stringify(embedded), refs, values };
}
