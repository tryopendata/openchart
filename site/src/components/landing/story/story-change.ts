/**
 * Describes a story step's change to the chart in plain words, for the one
 * muted line under its paragraph ("adds a shaded range for 2022"). The words
 * are read off the step's patch, not written beside it, so they cannot drift
 * from what the chart does. Pure: the island renders the sentence, the tests
 * read it.
 *
 * Patches restate earlier annotations (arrays replace when merged), so only
 * annotations that no earlier step showed are described.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { deepMergeSpec } from "@opendata-ai/openchart-core";
import type { StoryStep } from "@opendata-ai/openchart-vanilla/story";

type AnnotationLike = { id?: string; type?: string; label?: string; text?: string };

/**
 * A step's patch with the `highlight` shorthand folded in, as `createChartStory`
 * folds it: `null` clears a highlight, so it becomes an empty list.
 */
function stepPatch(step: StoryStep): Record<string, unknown> {
  const patch = step.spec ?? {};
  if (step.highlight === undefined) return patch;
  return deepMergeSpec(patch, { encoding: { color: { highlight: step.highlight ?? [] } } });
}

/** The spec after steps 0..index, merged the way the story merges them. */
function specAfter(base: ChartSpec, steps: readonly StoryStep[], index: number): ChartSpec {
  return steps
    .slice(0, index + 1)
    .reduce<ChartSpec>((spec, step) => deepMergeSpec(spec, stepPatch(step)), base);
}

/** Annotation text without the library's `**bold**` markers. */
const plainText = (text: string) => text.replaceAll("**", "");

function describeAnnotation(annotation: AnnotationLike): string {
  if (annotation.type === "range") {
    return annotation.label ? `adds a shaded range for ${annotation.label}` : "adds a shaded range";
  }
  if (annotation.type === "text") return `adds a callout, “${plainText(annotation.text ?? "")}”`;
  if (annotation.type === "refline") return "adds a reference line";
  return "adds an annotation";
}

/** The values of the color field that `after` draws and `before` did not: the series a step reveals. */
function revealedSeries(before: ChartSpec, after: ChartSpec): string[] {
  const field = (after.encoding.color as { field?: string } | undefined)?.field;
  if (!field) return [];
  const values = (spec: ChartSpec) =>
    new Set(spec.data.map((row) => String((row as Record<string, unknown>)[field])));
  const shown = values(before);
  return [...values(after)].filter((value) => !shown.has(value));
}

/** "A", "A and B", "A, B and C". */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The phrases for one step's change, in the order its patch lists them. */
function changePhrases(base: ChartSpec, steps: readonly StoryStep[], index: number): string[] {
  const step = steps[index];
  if (!step) throw new RangeError(`No story step ${index}: the story has ${steps.length} steps.`);
  const before = index === 0 ? base : specAfter(base, steps, index - 1);
  const after = specAfter(base, steps, index);
  const shownBefore = new Set(
    (before.annotations ?? []).map((note) => (note as AnnotationLike).id),
  );
  const phrases: string[] = [];
  for (const key of Object.keys(stepPatch(step))) {
    if (key === "annotations") {
      const fresh = (after.annotations ?? []).filter(
        (note) => !shownBefore.has((note as AnnotationLike).id),
      );
      phrases.push(...fresh.map((note) => describeAnnotation(note as AnnotationLike)));
    } else if (key === "data") {
      const series = revealedSeries(before, after);
      phrases.push(series.length > 0 ? `adds the ${listOf(series)} lines` : "changes the data");
    } else if (key === "encoding") {
      const highlight = (after.encoding.color as { highlight?: string[] } | undefined)?.highlight;
      phrases.push(
        highlight && highlight.length > 0
          ? `highlights ${listOf(highlight)} and dims the rest`
          : "changes the encoding",
      );
    } else {
      phrases.push(`changes the ${key}`);
    }
  }
  return phrases;
}

/**
 * The muted line under step `index`'s paragraph, or null for a step that changes
 * nothing (the story's opening).
 *
 * @throws {RangeError} When the story has no step `index`.
 */
export function describeChange(
  base: ChartSpec,
  steps: readonly StoryStep[],
  index: number,
): string | null {
  const phrases = changePhrases(base, steps, index);
  return phrases.length === 0 ? null : `In the spec, this step ${listOf(phrases)}.`;
}
