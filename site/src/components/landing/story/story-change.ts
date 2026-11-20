/**
 * Turns a story step's change into the short spec excerpt printed in the margin
 * beside its paragraph, so a reader sees which field produced what the chart
 * just did. Pure: the island renders the string, the tests read it.
 *
 * Patches restate earlier annotations (arrays replace when merged), so an
 * annotation already shown by an earlier step is elided as `…`, and data rows
 * are folded to a count, the way the hero's spec pane folds them.
 */
import type { StoryStep } from "@opendata-ai/openchart-vanilla/story";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Compact single-line JSON with a space after colons and commas, as a person would type it. */
export function inlineJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([key, item]) => `"${key}": ${inlineJson(item)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(value);
}

const annotationId = (annotation: unknown) =>
  annotation !== null && typeof annotation === "object" && "id" in annotation
    ? String(annotation.id)
    : undefined;

/** The ids of annotations that steps before `index` already put on the chart. */
function earlierAnnotationIds(steps: readonly StoryStep[], index: number): Set<string> {
  const ids = steps
    .slice(0, index)
    .flatMap((step) => (step.spec?.annotations as unknown[] | undefined) ?? [])
    .map(annotationId);
  return new Set(ids.filter((id): id is string => id !== undefined));
}

/** One top-level field of a patch, written for display. */
function fieldLine(key: string, value: unknown, earlier: Set<string>): string {
  if (key === "data" && Array.isArray(value)) return `"data": [ … ${value.length} rows ]`;
  if (key === "annotations" && Array.isArray(value)) {
    const fresh = value.filter((annotation) => !earlier.has(annotationId(annotation) ?? ""));
    // The id only tells steps apart; the reader's note shows what draws.
    const shown = fresh.map((annotation) => {
      const { id: _id, ...drawn } = annotation as Record<string, unknown>;
      return inlineJson(drawn);
    });
    if (fresh.length < value.length) shown.unshift("…");
    return `"annotations": [${shown.join(", ")}]`;
  }
  return `"${key}": ${inlineJson(value as Json)}`;
}

/**
 * The spec excerpt for step `index`: one line per top-level field the step
 * patches, plus `highlight` sugar written as the field it sets.
 */
export function changeExcerpt(steps: readonly StoryStep[], index: number): string[] {
  const step = steps[index];
  if (!step) throw new RangeError(`No story step ${index}: the story has ${steps.length} steps.`);
  const earlier = earlierAnnotationIds(steps, index);
  const lines = Object.entries(step.spec ?? {}).map(([key, value]) =>
    fieldLine(key, value, earlier),
  );
  if (step.highlight !== undefined) {
    lines.push(`"encoding": ${inlineJson({ color: { highlight: step.highlight } })}`);
  }
  return lines;
}
