/**
 * Which edits the edit section accepts: only a move of its one callout. Pure,
 * so EditDesk only holds the offset and renders.
 *
 * A move from the library (a drag or an arrow-key nudge) arrives as `set` ops
 * on the callout's `anchor`, `offset` and `responsive`. Rather than trusting
 * paths, the transaction is applied with core's `applyEditTransaction` and the
 * result compared with the spec: it is accepted only when nothing but the
 * callout's offset changed. A delete, an add, a text edit, a move of the
 * refline's label or a connector handle all change something else and are
 * refused, so the chart stays as authored.
 *
 * This module carries the chart library's core at runtime, so the island loads
 * it lazily; the offset helpers it re-exports live in callout-offset.ts.
 */
import {
  applyEditTransaction,
  type ChartSpec,
  type EditTransaction,
} from "@opendata-ai/openchart-core";
import { CALLOUT_INDEX, type Offset } from "./callout-offset";

export { type Offset, offsetLine } from "./callout-offset";

/** The spec's callout offset as a plain pair of numbers, or null when it is not one. */
function calloutOffset(spec: ChartSpec): Offset | null {
  const callout = spec.annotations?.[CALLOUT_INDEX];
  if (callout?.type !== "text" || !callout.offset) return null;
  const { dx = 0, dy = 0 } = callout.offset;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  return { dx, dy };
}

/** The spec as JSON with the callout's offset left out, for comparing everything else. */
function withoutCalloutOffset(spec: ChartSpec): string {
  const annotations = (spec.annotations ?? []).map((annotation, index) =>
    index === CALLOUT_INDEX ? { ...annotation, offset: undefined } : annotation,
  );
  return JSON.stringify({ ...spec, annotations });
}

/** A pixel count as the spec should hold it: whole, and never -0. */
const wholePixels = (value: number) => Math.round(value) || 0;

/**
 * The callout's new offset when the transaction only moves it, and null for
 * anything else (a delete, an add, a text edit, a change to another element).
 * The library reports a move to fractions of a pixel (`dy: 38.0007`); the
 * offset comes back in whole pixels, so the state, the spec the chart draws
 * and the readout all hold the same numbers.
 */
export function acceptedOffset(spec: ChartSpec, transaction: EditTransaction): Offset | null {
  if (transaction.ops.length === 0) return null;
  const result = applyEditTransaction(spec, transaction);
  if (!result.ok) return null;
  const next = calloutOffset(result.spec);
  if (!next) return null;
  if (withoutCalloutOffset(result.spec) !== withoutCalloutOffset(spec)) return null;
  return { dx: wholePixels(next.dx), dy: wholePixels(next.dy) };
}
