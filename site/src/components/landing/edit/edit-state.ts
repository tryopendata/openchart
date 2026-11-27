/**
 * Which edits the edit section accepts: only a move of its one callout. Pure,
 * so EditDesk only holds the offset and renders.
 */
import type { ChartSpec, EditTransaction } from "@opendata-ai/openchart-core";

/** The callout's offset from its anchor, in pixels. */
export type Offset = { dx: number; dy: number };

/**
 * The callout's new offset when the transaction only moves it, and null for
 * anything else (a delete, an add, a text edit, a change to another element).
 */
export function acceptedOffset(_spec: ChartSpec, _transaction: EditTransaction): Offset | null {
  throw new Error("acceptedOffset is not implemented.");
}

/** The spec line the readout shows for an offset, with whole numbers. */
export function offsetLine(_offset: Offset): string {
  throw new Error("offsetLine is not implemented.");
}
