/**
 * The demo contract: one definition of a live visualization that MDX pages, the
 * gallery and the landing page all render through the same figure.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";

/** Where a demo's data came from. Use the label "Illustrative data" when it is invented. */
export type DemoSource = { label: string; url?: string };

export type DemoDef = {
  /** "<group>/<name>": lowercase letters, digits and hyphens around one slash. Unique across the site. */
  id: string;
  title: string;
  /** The full spec with its data inline. */
  spec: VizSpec;
  source: DemoSource;
  caption?: string;
  /** Fixed height of the stage in px. Default `DEFAULT_DEMO_HEIGHT`. */
  height?: number;
  /** Play the library's entrance animation on live mount. Default false. */
  entrance?: boolean;
  /**
   * Render static SVGs at build time. Default true. Set false for a heavy demo:
   * its stage then shows a short placeholder line and mounts client side, as a table does.
   */
  static?: boolean;
};

/** The stage height in px for a demo or a `json demo` fence that sets none. */
export const DEFAULT_DEMO_HEIGHT = 400;

const DEMO_ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;

/**
 * Declares a demo. The registry collects every exported value this returns.
 *
 * @throws {TypeError} When the id is not "<group>/<name>" in lowercase letters, digits and hyphens.
 */
export function defineDemo(def: DemoDef): DemoDef {
  if (!DEMO_ID.test(def.id)) {
    throw new TypeError(`Demo id "${def.id}" must look like "group/name" in lowercase.`);
  }
  return def;
}
