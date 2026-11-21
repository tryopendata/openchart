/**
 * The spec fields an entry page lists beside its chart: what draws it (the
 * mark, the layers or the type), the channels it encodes, and then whatever
 * else shapes this chart, such as transforms, annotations, table cells or map
 * settings. Read from the spec itself, so the notes cannot drift from the code
 * the reader copies.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";

/** One spec field and the parts of it worth reading, each printed as code. */
export type SpecNote = { field: string; values: string[] };

/** The most notes an entry page shows. */
export const MAX_NOTES = 4;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Mark options that only paint the mark, which every reader can see without a note. */
const PAINT = new Set(["type", "fill", "stroke", "strokeWidth", "opacity", "fillOpacity"]);

/** Top-level keys every spec of a type carries, or that the other notes already cover. */
const COMMON = new Set(["type", "data", "chrome", "theme", "encoding", "columns", "animation"]);

/** `key: value` for a string, number or boolean, else the key alone. */
function setting(key: string, value: unknown): string {
  if (typeof value === "string") return `${key}: "${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return `${key}: ${value}`;
  return key;
}

function markNote(mark: unknown): SpecNote {
  if (!isObject(mark)) return { field: "mark", values: [JSON.stringify(mark)] };
  const options = Object.entries(mark)
    .filter(([key]) => !PAINT.has(key))
    .map(([key, value]) => setting(key, value));
  return { field: "mark", values: [JSON.stringify(mark.type), ...options] };
}

function layerNote(layers: unknown[]): SpecNote {
  const marks = layers.map((layer) => {
    const mark = isObject(layer) ? layer.mark : undefined;
    return JSON.stringify(isObject(mark) ? mark.type : mark);
  });
  return { field: "layer", values: marks };
}

/** The first key of each transform step: `fold`, `calculate`, `bin`. */
function transformNote(transform: unknown[]): SpecNote {
  return {
    field: "transform",
    values: transform.map((step) => (isObject(step) ? (Object.keys(step)[0] ?? "") : "")),
  };
}

function annotationNote(annotations: unknown[]): SpecNote {
  const types = annotations.map((note) => (isObject(note) ? String(note.type) : ""));
  return { field: "annotations", values: types.map((type) => `"${type}"`) };
}

/** A table's columns that draw in their cells, as `key.heatmap` or `key.bar`. */
function columnsNote(columns: unknown[]): SpecNote {
  const drawn = columns.flatMap((column) => {
    if (!isObject(column)) return [];
    return ["heatmap", "bar", "sparkline", "delta", "image", "flag"]
      .filter((cell) => cell in column)
      .map((cell) => `${String(column.key)}.${cell}`);
  });
  return { field: "columns", values: drawn.length > 0 ? drawn : [`${columns.length} columns`] };
}

/** The settings outside `encoding` that shape a non-chart spec: projection, palette, sort. */
function settingsNotes(spec: Json): SpecNote[] {
  return Object.entries(spec)
    .filter(([key]) => !COMMON.has(key))
    .map(([key, value]) => {
      if (!isObject(value)) return { field: key, values: [setting(key, value)] };
      const scalars = Object.entries(value).filter(([, v]) => !isObject(v) && !Array.isArray(v));
      const values = scalars.map(([k, v]) => setting(k, v));
      return { field: key, values: values.length > 0 ? values : Object.keys(value) };
    });
}

/** The 2 to 4 fields worth reading in `spec`, most telling first. */
export function specNotes(spec: VizSpec): SpecNote[] {
  const source = spec as unknown as Json;
  const notes: SpecNote[] = [];
  if ("mark" in source) notes.push(markNote(source.mark));
  else if (Array.isArray(source.layer)) notes.push(layerNote(source.layer));
  else notes.push({ field: "type", values: [JSON.stringify(source.type)] });
  if (isObject(source.encoding)) {
    notes.push({ field: "encoding", values: Object.keys(source.encoding) });
  }
  if (Array.isArray(source.transform)) notes.push(transformNote(source.transform));
  if (Array.isArray(source.annotations)) notes.push(annotationNote(source.annotations));
  if (Array.isArray(source.columns)) notes.push(columnsNote(source.columns));
  if (!("mark" in source) && !("layer" in source)) notes.push(...settingsNotes(source));
  return notes.filter((note) => note.values.length > 0).slice(0, MAX_NOTES);
}
