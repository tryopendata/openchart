/**
 * The spec fields an entry page lists beside its chart, each something the
 * chart itself does not say: which field each channel reads (`x: date`), the
 * mark's options, the transforms and annotations, a table's drawn cells and a
 * map's settings, under their real spec paths. Read from the spec itself, so
 * the notes cannot drift from the code the reader copies. A note that only
 * restates what the chart shows, such as a map's `type`, is left out.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";

/** One spec path and what it holds, each value printed as code. */
export type SpecNote = { field: string; values: string[] };

/** The most notes an entry page shows. */
export const MAX_NOTES = 4;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isScalar = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** Mark options that only paint the mark, which the reader sees without a note. */
const PAINT = new Set(["type", "fill", "stroke", "strokeWidth", "opacity", "fillOpacity"]);

/** Top-level keys every spec of a type carries, or that a note of their own covers. */
const COMMON = new Set([
  "type",
  "data",
  "chrome",
  "theme",
  "encoding",
  "columns",
  "animation",
  "legend",
  "labels",
]);

/** Keys inside a setting that hold data or geometry, not a choice an author made. */
const BULK = new Set(["features", "data"]);

const json = (value: unknown) => (typeof value === "string" ? `"${value}"` : String(value));

/** `channel: field` for every channel that reads a field. */
function encodingNote(encoding: Json): SpecNote {
  const pairs = Object.entries(encoding).flatMap(([channel, value]) =>
    isObject(value) && typeof value.field === "string" ? [`${channel}: ${value.field}`] : [],
  );
  return { field: "encoding", values: pairs };
}

/** A mark given as a name prints the name alone; as an object, its type and the options that shape it. */
function markNote(mark: unknown): SpecNote {
  if (!isObject(mark)) return { field: "mark", values: [json(mark)] };
  const options = Object.entries(mark)
    .filter(([key]) => !PAINT.has(key))
    .flatMap(([key, value]) => {
      if (isScalar(value)) return [`${key}: ${json(value)}`];
      if (!isObject(value)) return [];
      return Object.entries(value)
        .filter(([, inner]) => isScalar(inner))
        .map(([inner, setting]) => `${key}.${inner}: ${json(setting)}`);
    });
  return { field: "mark", values: [`type: ${json(mark.type)}`, ...options] };
}

/** Each layer's mark, in order. */
function layerNote(layers: unknown[]): SpecNote {
  const marks = layers.map((layer, index) => {
    const mark = isObject(layer) ? layer.mark : undefined;
    return `[${index}]: ${json(isObject(mark) ? mark.type : mark)}`;
  });
  return { field: "layer", values: marks };
}

/** Each transform step: its operation and, for a short one, what it reads. */
function transformNote(transform: unknown[]): SpecNote {
  const steps = transform.flatMap((step) => {
    if (!isObject(step)) return [];
    const [op = "", value] = Object.entries(step)[0] ?? [];
    const shown = Array.isArray(value) ? value.map(json).join(", ") : "";
    return [shown ? `${op}: ${shown}` : op];
  });
  return { field: "transform", values: steps };
}

/** Each annotation's type and where it is anchored. */
function annotationNote(annotations: unknown[]): SpecNote {
  const notes = annotations.flatMap((note) => {
    if (!isObject(note)) return [];
    const at = ["x", "y"]
      .filter((axis) => note[axis] !== undefined)
      .map((axis) => `${axis} ${note[axis]}`)
      .join(", ");
    return [at ? `${note.type} at ${at}` : String(note.type)];
  });
  return { field: "annotations", values: notes };
}

/** The cells a table draws, under their real paths: `columns[1].heatmap`. */
function columnNotes(columns: unknown[]): SpecNote[] {
  return columns.flatMap((column, index) => {
    if (!isObject(column)) return [];
    return ["heatmap", "bar", "sparkline", "delta", "image", "flag"]
      .filter((cell) => cell in column)
      .map((cell) => {
        const config = column[cell];
        const values = isObject(config)
          ? Object.entries(config)
              .filter(([, value]) => isScalar(value))
              .map(([key, value]) => `${key}: ${json(value)}`)
          : [];
        return { field: `columns[${index}].${cell}`, values: values.length > 0 ? values : ["{}"] };
      });
  });
}

/** A non-chart spec's own settings: a scalar alone, or each scalar or field inside an object. */
function settingNotes(spec: Json): SpecNote[] {
  return Object.entries(spec)
    .filter(([key]) => !COMMON.has(key))
    .flatMap(([key, value]) => {
      if (isScalar(value)) return [{ field: key, values: [json(value)] }];
      if (!isObject(value)) return [];
      return Object.entries(value)
        .filter(([child]) => !BULK.has(child))
        .flatMap(([child, inner]) => {
          if (isScalar(inner)) return [{ field: `${key}.${child}`, values: [json(inner)] }];
          if (isObject(inner) && typeof inner.field === "string") {
            return [{ field: `${key}.${child}`, values: [`field: ${inner.field}`] }];
          }
          return [];
        });
    });
}

/** The 2 to 4 fields worth reading in `spec`, most telling first. */
export function specNotes(spec: VizSpec): SpecNote[] {
  const source = spec as unknown as Json;
  const notes: SpecNote[] = [];
  if ("mark" in source) notes.push(markNote(source.mark));
  if (Array.isArray(source.layer)) notes.push(layerNote(source.layer));
  if (isObject(source.encoding)) notes.push(encodingNote(source.encoding));
  if (Array.isArray(source.transform)) notes.push(transformNote(source.transform));
  if (Array.isArray(source.annotations)) notes.push(annotationNote(source.annotations));
  if (Array.isArray(source.columns)) notes.push(...columnNotes(source.columns));
  if (!("mark" in source) && !("layer" in source)) notes.push(...settingNotes(source));
  return notes.filter((note) => note.values.length > 0).slice(0, MAX_NOTES);
}
