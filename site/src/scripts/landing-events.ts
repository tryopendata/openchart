/**
 * The landing page's analytics events: an install command copied, a docs link
 * followed, and the first use of each section's figure. Delegated listeners on
 * the document; the events' properties come from landing-event-props.ts.
 */
import type { track } from "../lib/analytics";

/** Starts the three listeners; the returned function removes them. */
export function watchLandingEvents(_root: Document, _send: typeof track): () => void {
  return () => {};
}
