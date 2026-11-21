/**
 * Finds the bulky values in a spec (data rows, a points layer's rows, graph
 * nodes and edges, TopoJSON under `geo`) and writes JSON with each one folded:
 * as a marker for a copy template, or for the code a panel shows, as a
 * one-line comment naming what was folded and its size. A long list folded as
 * an excerpt shows its first rows and a comment counting the rest instead.
 * Build time only.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { FOLD_MARKER_TEXT, foldMarker, foldSentinel, lineIndent } from "./fold-fill";
import type { SpecPath } from "./markup";

/**
 * One bulky value in a spec, where it is, and how its folded comment describes
 * it. `unit` names one row or element ("row", "node"), empty for geography.
 * `excerpt` shows the value's first rows before the comment instead of none.
 */
export type FoldTarget = {
  path: SpecPath;
  value: object;
  label: string;
  unit: string;
  geography: boolean;
  excerpt?: boolean;
};

/** A list of rows or elements longer than this is shown as an excerpt in the Spec panel. */
export const MAX_SHOWN_ROWS = 12;
/** How many rows an excerpt shows before the comment counting the rest. */
export const EXCERPT_ROWS = 6;

/** Thrown when a spec already contains the text fold markers are made of. */
export class FoldMarkerError extends Error {}

/** The keys that hold rows or graph elements, and what one of them is called. */
const BULK_KEYS: readonly { path: SpecPath; unit: string }[] = [
  { path: ["data"], unit: "row" },
  { path: ["nodes"], unit: "node" },
  { path: ["edges"], unit: "edge" },
  { path: ["points", "data"], unit: "row" },
];

const counted = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

function lookup(root: unknown, path: SpecPath): unknown {
  return path.reduce<unknown>(
    (value, key) =>
      typeof value === "object" && value !== null
        ? (value as Record<string | number, unknown>)[key]
        : undefined,
    root,
  );
}

/** A place bulk may live: geography folds any object, rows only arrays unless `records`. */
type Candidate = { path: SpecPath; unit: string; geography: boolean; records: boolean };

function isFoldable(value: unknown, records: boolean): value is object {
  if (Array.isArray(value)) return value.length > 0;
  if (!records || typeof value !== "object" || value === null) return false;
  return Object.keys(value).length > 0;
}

function candidates(spec: VizSpec): Candidate[] {
  const geography = geographyPaths(spec).map((path) => ({
    path,
    unit: "",
    geography: true,
    records: true,
  }));
  // A tile map's data may be a record of values by state; anywhere else an object under `data` is a source such as `{ url }`.
  const records = (spec as { type?: unknown }).type === "tilemap";
  const bulk = BULK_KEYS.map((key) => ({ ...key, geography: false, records }));
  return [...geography, ...bulk];
}

function sizeLabel(value: object, unit: string): string {
  if (Array.isArray(value)) return counted(value.length, unit);
  return counted(Object.keys(value).length, "entry", "entries");
}

function geographyLabel(value: object): string {
  const geo = value as { type?: unknown; arcs?: unknown; features?: unknown };
  if (geo.type === "Topology" && Array.isArray(geo.arcs)) {
    return `TopoJSON, ${counted(geo.arcs.length, "arc")}`;
  }
  if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
    return `GeoJSON, ${counted(geo.features.length, "feature")}`;
  }
  return "geometry";
}

function geographyPaths(spec: VizSpec): SpecPath[] {
  const layers = lookup(spec, ["geo", "detailLayers"]);
  const layerPaths = Array.isArray(layers)
    ? layers.map((_layer, index): SpecPath => ["geo", "detailLayers", index, "features"])
    : [];
  return [["geo", "features"], ...layerPaths];
}

/**
 * Every bulky value in the spec, each object once, geography first.
 *
 * @throws {FoldMarkerError} When the spec's JSON contains the text fold markers use.
 */
export function foldTargets(spec: VizSpec): FoldTarget[] {
  if (JSON.stringify(spec).includes(FOLD_MARKER_TEXT)) {
    throw new FoldMarkerError(
      `A spec value contains "${FOLD_MARKER_TEXT}", which marks folded code.`,
    );
  }
  const seen = new Set<unknown>();
  const targets: FoldTarget[] = [];
  for (const { path, unit, geography, records } of candidates(spec)) {
    const value = lookup(spec, path);
    if (!isFoldable(value, records) || seen.has(value)) continue;
    seen.add(value);
    const label = geography ? geographyLabel(value) : sizeLabel(value, unit);
    targets.push({ path, value, label, unit, geography });
  }
  return targets;
}

/** The value as indented JSON, with each target written as its fold marker. */
export function jsonWithMarkers(value: unknown, targets: readonly FoldTarget[]): string {
  const indexes = new Map<unknown, number>(targets.map((target, index) => [target.value, index]));
  return JSON.stringify(
    value,
    (_key, current: unknown) => {
      const index = indexes.get(current);
      return index === undefined ? current : foldSentinel(index);
    },
    2,
  );
}

/** Whether the Spec panel shows only an excerpt of this value: a list of rows or elements over the cap. */
export function isLongList(target: FoldTarget): boolean {
  return !target.geography && Array.isArray(target.value) && target.value.length > MAX_SHOWN_ROWS;
}

function foldComment(target: FoldTarget): string {
  let comment = `/* ${target.label}, as in the Spec tab; Copy includes them */`;
  if (target.geography) comment = `/* ${target.label}; Copy includes it */`;
  // The Spec tab shows only an excerpt of a long list, so the comment can't point there.
  else if (isLongList(target)) comment = `/* ${target.label}; Copy includes them */`;
  return Array.isArray(target.value) ? `[${comment}]` : `{${comment}}`;
}

/** A list's first rows as indented JSON, then a line comment counting the rows left out. */
function excerpt(target: FoldTarget, indent: string): string {
  const rows = target.value as unknown[];
  const inner = `${indent}  `;
  const shown = rows
    .slice(0, EXCERPT_ROWS)
    .map((row) => `${inner}${JSON.stringify(row, null, 2).replaceAll("\n", `\n${inner}`)},`);
  const rest = counted(rows.length - EXCERPT_ROWS, `more ${target.unit}`);
  return `[\n${shown.join("\n")}\n${inner}// … ${rest}; Copy includes them\n${indent}]`;
}

/** Each occurrence of the marker replaced by `render`, given the indent of the line it is on. */
function replaceMarker(code: string, marker: string, render: (indent: string) => string): string {
  const [first = "", ...rest] = code.split(marker);
  return rest.reduce((out, part) => out + render(lineIndent(out, out.length)) + part, first);
}

/** Code from `jsonWithMarkers` as a reader sees it: each marker replaced by a comment or an excerpt. */
export function showFolds(code: string, targets: readonly FoldTarget[]): string {
  return targets.reduce(
    (shown, target, index) =>
      replaceMarker(shown, foldMarker(index), (indent) =>
        target.excerpt ? excerpt(target, indent) : foldComment(target),
      ),
    code,
  );
}
