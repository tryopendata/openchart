/**
 * The demo contract: one definition of a live visualization that MDX pages, the
 * gallery and the landing page all render through the same figure.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";

/** Where a demo's data came from. Use the label "Illustrative data" when it is invented. */
export type DemoSource = { label: string; url?: string };

/** Another state of the same chart. A button moves the live chart to it with `update`, so the library's update transition plays. */
export type DemoState = { label: string; spec: VizSpec };

/** Reader controls under the stage. Every control ships `hidden` and is shown once its script has wired it. Chart and layer specs only. */
export type DemoControls = {
  /** Buttons that switch between `spec` (named `initialLabel`) and each of `others` (one to five). */
  states?: { initialLabel: string; others: readonly DemoState[] };
  /** A Replay button: remount and play the entrance (no animation under reduced motion). */
  replay?: boolean;
  /** A list under the stage of the events the chart emits, newest first, at most eight. */
  eventLog?: boolean;
  /** Download buttons, in this order. */
  exports?: readonly ("svg" | "png" | "csv")[];
};

/** Host options that are not part of the spec. */
export type DemoMountOptions = { renderer?: "svg" | "canvas"; interaction?: "select" | "edit" };

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
  /** Stage height in px on phones (under 640px), for a chart that needs more room when narrow. Default: `height`. */
  phoneHeight?: number;
  /** Play the library's entrance animation when the live chart is first seen. Default true. */
  entrance?: boolean;
  /**
   * Render static SVGs at build time. Default true. Set false for a heavy demo:
   * its stage then shows a short placeholder line and mounts client side, as a table does.
   */
  static?: boolean;
  controls?: DemoControls;
  mount?: DemoMountOptions;
  /** Use the site's chart theme (fonts, ink, transparent background). Default true. Set false when the spec's own `theme` must show, as with a preset. */
  pageTheme?: boolean;
  /** Layout width in px (280 to 720) for the static SVGs, and the stage's maximum width, to show a compact or medium layout. Default: full article width, statics at 720. */
  width?: number;
};

/** The stage height in px for a demo or a `json demo` fence that sets none. */
export const DEFAULT_DEMO_HEIGHT = 400;

const DEMO_ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;
/** The layout widths a demo may ask for: a phone at the low end, the static SVG width at the top. */
export const DEMO_WIDTH_RANGE = { min: 280, max: 720 } as const;

/**
 * Declares a demo. The registry collects every exported value this returns.
 *
 * @throws {TypeError} When the id is not "<group>/<name>" in lowercase letters, digits and hyphens,
 * or `width` is outside 280 to 720.
 */
export function defineDemo(def: DemoDef): DemoDef {
  if (!DEMO_ID.test(def.id)) {
    throw new TypeError(`Demo id "${def.id}" must look like "group/name" in lowercase.`);
  }
  const { width } = def;
  if (width !== undefined && !(width >= DEMO_WIDTH_RANGE.min && width <= DEMO_WIDTH_RANGE.max)) {
    throw new TypeError(
      `Demo "${def.id}" has width ${width}. Use ${DEMO_WIDTH_RANGE.min} to ${DEMO_WIDTH_RANGE.max}, or leave it out for the full article width.`,
    );
  }
  return def;
}
