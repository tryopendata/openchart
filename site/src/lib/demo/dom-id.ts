/**
 * Ids for demo figures. Static SVGs need an id prefix that is unique per figure
 * and per theme, and a fence has no author-given id, so both are derived here.
 */
import { createHash } from "node:crypto";

/** A demo id as an XML-safe prefix: "comparison/bar" becomes "d-comparison-bar". */
export function demoDomId(id: string): string {
  return `d-${id.replaceAll("/", "-")}`;
}

/** The figure id for a `json demo` fence, stable for a given spec text. */
export function fenceDemoId(specJson: string): string {
  return `fence-${createHash("sha256").update(specJson).digest("hex").slice(0, 8)}`;
}
