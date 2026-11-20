/**
 * Finds the bulky values in a spec (data rows, a points layer's rows, graph
 * nodes and edges, TopoJSON under `geo`) and writes JSON with each one folded:
 * as a marker for a copy template, or as a one-line comment naming what was
 * folded and its size for the code a panel shows. Build time only.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { FOLD_MARKER_TEXT, foldMarker, foldSentinel } from "./fold-fill";
import type { SpecPath } from "./markup";

/** One bulky value in a spec, where it is, and how its folded comment describes it. */
export type FoldTarget = { path: SpecPath; value: object; label: string; geography: boolean };

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
  `${count} ${count === 1 ? one : many}`;

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
    targets.push({ path, value, label, geography });
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

function foldComment(target: FoldTarget): string {
  const comment = target.geography
    ? `/* ${target.label}; Copy includes it */`
    : `/* ${target.label}, as in the Spec tab; Copy includes them */`;
  return Array.isArray(target.value) ? `[${comment}]` : `{${comment}}`;
}

/** Code from `jsonWithMarkers` as a reader sees it: each marker replaced by a comment. */
export function showFolds(code: string, targets: readonly FoldTarget[]): string {
  return targets.reduce(
    (shown, target, index) => shown.replaceAll(foldMarker(index), foldComment(target)),
    code,
  );
}
