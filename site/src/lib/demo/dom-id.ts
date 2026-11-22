/**
 * Ids for demo figures. Static SVGs need an id prefix that is unique per figure
 * and per theme, and a fence has no author-given id, so both are derived here.
 * A post's hero may show the same demo as its body, so the hero's ids differ.
 */
import { createHash } from "node:crypto";

/**
 * A demo id as an XML-safe prefix: "comparison/bar" becomes "d-comparison-bar",
 * and with `hero` set "d-comparison-bar-hero", apart from the body's copy.
 */
export function demoDomId(id: string, { hero = false }: { hero?: boolean } = {}): string {
  const base = `d-${id.replaceAll("/", "-")}`;
  return hero ? `${base}-hero` : base;
}

/** The figure id for a `json demo` fence, stable for a given spec text. */
export function fenceDemoId(specJson: string): string {
  return `fence-${createHash("sha256").update(specJson).digest("hex").slice(0, 8)}`;
}
