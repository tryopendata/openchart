/**
 * The excerpt of the spec printed beside the edit section's chart: the
 * `annotations` array with the callout written out as it is in the spec, and
 * its offset as the one line that changes. Generated from the spec object, so
 * it can never disagree with the chart.
 *
 * It is an excerpt, not the whole array. The callout's other keys (`anchor`,
 * `connector`, `responsive`) are left out because they say how the library
 * draws the callout, not where the reader put it, and would only crowd the
 * line that matters; a `…` line stands where they are. The annotations after
 * the callout (the target line) get a `…` line too.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { CALLOUT_INDEX } from "./callout-offset";

/** The callout's keys printed in full, in this order; the offset follows them on its own line. */
const SHOWN_KEYS = ["type", "text", "x", "y"] as const;
const OMITTED = "…";

/** One line of the excerpt at a nesting depth; `offset` marks where the live offset line goes. */
export type ExcerptLine = { depth: number } & ({ text: string } | { offset: true });

/** The lines of the excerpt for `spec`'s callout. Throws if the spec has no text callout. */
export function calloutExcerpt(spec: ChartSpec): ExcerptLine[] {
  const annotations = spec.annotations ?? [];
  const callout = annotations[CALLOUT_INDEX];
  if (callout?.type !== "text") {
    throw new Error(
      `The edit section's spec needs a text annotation at index ${CALLOUT_INDEX}; found ${callout?.type ?? "none"}.`,
    );
  }
  const entries = callout as unknown as Record<string, unknown>;
  const shown = SHOWN_KEYS.filter((key) => entries[key] !== undefined).map((key) => ({
    depth: 2,
    text: `${JSON.stringify(key)}: ${JSON.stringify(entries[key])},`,
  }));
  const hasOmittedKeys = Object.keys(entries).some(
    (key) => key !== "offset" && !(SHOWN_KEYS as readonly string[]).includes(key),
  );
  const moreAnnotations = annotations.length > CALLOUT_INDEX + 1;
  return [
    { depth: 0, text: '"annotations": [' },
    { depth: 1, text: "{" },
    ...shown,
    ...(hasOmittedKeys ? [{ depth: 2, text: OMITTED }] : []),
    { depth: 2, offset: true },
    { depth: 1, text: moreAnnotations ? "}," : "}" },
    ...(moreAnnotations ? [{ depth: 1, text: OMITTED }] : []),
    { depth: 0, text: "]" },
  ];
}
