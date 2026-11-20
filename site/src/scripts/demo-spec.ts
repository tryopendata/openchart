/**
 * Reads a demo figure's spec back from the page: the embedded spec JSON, with
 * each shared value it references (see markup.ts) filled in from the page's
 * shared value block. The live mount and the Copy buttons both read specs here.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { DEMO_ATTR, type DemoSharedRef } from "../lib/demo/markup";
import { setValueAt } from "../lib/demo/spec-path";

/** Thrown when a figure's spec, or a shared value it references, is missing from the page. */
export class DemoSpecError extends Error {}

function sharedValue(doc: Document, hash: string): unknown {
  // Hashes are hex, the build writes them, so they need no escaping in a selector.
  const block = doc.querySelector(`script[${DEMO_ATTR.shared}="${hash}"]`);
  if (!block) {
    throw new DemoSpecError(`The page has no shared value block ${hash} for this demo's spec.`);
  }
  return JSON.parse(block.textContent ?? "");
}

/**
 * The figure's complete spec, parsed fresh on each call so a caller may change it.
 *
 * @throws {DemoSpecError} When the figure has no spec, or a shared value block it references is missing.
 * @throws {SyntaxError} When the spec or a shared block is not valid JSON.
 */
export function readFigureSpec(figure: Element): VizSpec {
  const script = figure.querySelector(`script[${DEMO_ATTR.spec}]`);
  if (!script) throw new DemoSpecError("The figure has no embedded spec.");
  const spec: unknown = JSON.parse(script.textContent ?? "");
  const refs = JSON.parse(script.getAttribute(DEMO_ATTR.sharedRefs) ?? "[]") as DemoSharedRef[];
  for (const { path, hash } of refs)
    setValueAt(spec, path, sharedValue(figure.ownerDocument, hash));
  return spec as VizSpec;
}
