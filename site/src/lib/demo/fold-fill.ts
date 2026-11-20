/**
 * Markers for folded values in demo code. A code panel shows bulky values (data
 * rows, TopoJSON, graph nodes) folded to a comment, and its copy template holds
 * a marker in their place instead of a second copy of the value; the Copy button
 * fills each marker back in from the figure's spec. A marker is the JSON text of
 * a string that starts with a NUL character, and the build refuses a spec that
 * already contains that text, so a marker never matches real code.
 */
import type { SpecPath } from "./markup";
import { valueAt } from "./spec-path";

/** Thrown when a copy template and its spec do not fit together. */
export class FoldFillError extends Error {}

const SENTINEL_PREFIX = "\u0000demo-fold:";

/** The string value the build puts in place of the folded value with this index. */
export function foldSentinel(index: number): string {
  return `${SENTINEL_PREFIX}${index}`;
}

/** How a sentinel reads once the code is JSON text: its marker. */
export function foldMarker(index: number): string {
  return JSON.stringify(foldSentinel(index));
}

/** The text inside every marker, which the JSON of a spec may not contain. */
export const FOLD_MARKER_TEXT = JSON.stringify(SENTINEL_PREFIX).slice(1, -1);

/** The leading spaces of the line `position` is on. */
function lineIndent(code: string, position: number): string {
  const lineStart = code.lastIndexOf("\n", position - 1) + 1;
  return /^ */.exec(code.slice(lineStart))?.[0] ?? "";
}

/** Replaces every occurrence of one marker with the value, indented to match its line. */
function fillMarker(code: string, marker: string, value: unknown): string {
  let filled = code;
  let at = filled.indexOf(marker);
  if (at < 0) throw new FoldFillError(`The copy template has no marker ${marker}.`);
  while (at >= 0) {
    const indent = lineIndent(filled, at);
    const json = JSON.stringify(value, null, 2).replaceAll("\n", `\n${indent}`);
    filled = filled.slice(0, at) + json + filled.slice(at + marker.length);
    at = filled.indexOf(marker, at + json.length);
  }
  return filled;
}

/**
 * The complete code: each marker in the template replaced by the value at the
 * matching path in the spec, written out as the unfolded code writes it.
 *
 * @param folds The key path of each folded value, in marker order.
 * @throws {FoldFillError} When a marker is missing from the template.
 * @throws {SpecPathError} When a path leads to no value in the spec.
 */
export function fillFolds(template: string, folds: readonly SpecPath[], spec: unknown): string {
  return folds.reduce(
    (code, path, index) => fillMarker(code, foldMarker(index), valueAt(spec, path)),
    template,
  );
}
