/**
 * The edit section's one-time self-demonstration: the callout moves to a
 * second position and back, so the reader sees it can be dragged.
 */
import type { Offset } from "./edit-state";

/** What the demonstration needs from the island. */
export type CalloutDemoOptions = {
  /** Where the callout starts and ends. */
  from: Offset;
  /** Where it goes in between. */
  to: Offset;
  /** Called with each offset on the way. */
  onOffset: (offset: Offset) => void;
};

/** Plays the demonstration once; the returned function stops it at once. */
export function playCalloutDemo(_options: CalloutDemoOptions): () => void {
  throw new Error("playCalloutDemo is not implemented.");
}
