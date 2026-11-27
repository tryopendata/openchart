/**
 * The edit section's callout offset as a value: putting it into the spec,
 * comparing two, and the spec line the readout prints. Pure, with no runtime
 * import from the chart library, so the island's up-front JavaScript stays
 * small; the edit rules that need the library live in edit-state.ts.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";

/** The callout's offset from its anchor, in pixels. */
export type Offset = { dx: number; dy: number };

/** The callout's index in `spec.annotations`. */
export const CALLOUT_INDEX = 0;

/** The spec with its callout moved to `offset`; the spec itself is not changed. */
export function specWithOffset(spec: ChartSpec, offset: Offset): ChartSpec {
  const annotations = (spec.annotations ?? []).map((annotation, index) =>
    index === CALLOUT_INDEX ? { ...annotation, offset: { ...offset } } : annotation,
  );
  return { ...spec, annotations };
}

/** True when two offsets put the callout in the same place. */
export function sameOffset(a: Offset, b: Offset): boolean {
  return a.dx === b.dx && a.dy === b.dy;
}

/** One run of the readout line: a fixed piece of JSON, or one of the offset's numbers. */
export type OffsetLinePart = { text: string; number: boolean };

/** The readout line in runs, so the numbers can be set apart from the JSON around them. */
export function offsetLineParts(offset: Offset): OffsetLinePart[] {
  const fixed = (text: string) => ({ text, number: false });
  // `|| 0` turns a rounded -0 into 0, which is what the spec would hold.
  const number = (value: number) => ({ text: String(Math.round(value) || 0), number: true });
  return [
    fixed('"offset": { "dx": '),
    number(offset.dx),
    fixed(', "dy": '),
    number(offset.dy),
    fixed(" }"),
  ];
}

/** The spec line the readout shows for an offset, with whole numbers. */
export function offsetLine(offset: Offset): string {
  return offsetLineParts(offset)
    .map((part) => part.text)
    .join("");
}
