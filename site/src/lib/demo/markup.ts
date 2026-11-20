/**
 * The names in the demo figure's markup contract: the data attributes and
 * classes that the figure builder writes and the page scripts query. demo.css
 * and the hand-written fixture page use the same names as literals.
 *
 * Shared values: a large value that several figures on one page carry (a map's
 * atlas, a dataset) is written once per page, as the JSON text of a
 * `<script type="application/json" data-demo-shared="<hash>">`. Each figure's
 * embedded spec holds `null` at that place, and the spec script's
 * `data-demo-shared-refs` attribute lists `{ path, hash }` pairs saying which
 * places to fill from which block. The references live in an attribute, outside
 * the spec, so no value a spec really holds can be mistaken for one.
 */

/** The data attributes on a demo figure and its parts. */
export const DEMO_ATTR = {
  /** On the `<figure>`, holding the demo id. */
  figure: "data-demo",
  /** On the stage that holds the static SVGs and later the live chart. */
  stage: "data-demo-stage",
  /** On the paragraph a stage without a static SVG shows until its live chart mounts. */
  placeholder: "data-demo-placeholder",
  /** On the `<script type="application/json">` holding the spec. */
  spec: "data-demo-spec",
  /** On the spec script, holding the JSON list of `DemoSharedRef` to fill in before mounting. */
  sharedRefs: "data-demo-shared-refs",
  /** On a page's `<script type="application/json">` holding one shared value, keyed by its hash. */
  shared: "data-demo-shared",
  /** On the code block: the tab strip and the panels. */
  code: "data-demo-code",
  /** On each tab link, holding its framework id. */
  tab: "data-demo-tab",
  /** On each code panel, holding its framework id. */
  panel: "data-demo-panel",
  /** On each panel's Copy button. */
  copy: "data-demo-copy",
  /** On a panel's `<template>` holding the code its Copy button copies. */
  copySource: "data-demo-copy-source",
  /**
   * On a copy template whose code has folded values, holding the JSON list of
   * their key paths in the spec, in marker order (see fold-fill.ts).
   */
  copyFills: "data-demo-copy-fills",
  /** On the code block once the script runs, holding the chosen framework id. */
  choice: "data-demo-choice",
  /** On the figure when the live mount plays the library's entrance. */
  entrance: "data-demo-entrance",
  /** On the stage once a live chart is mounted. */
  live: "data-demo-live",
  /** On the stage once a live mount has failed. */
  error: "data-demo-error",
} as const;

/** The classes on the static SVGs and on the live chart's host element. */
export const DEMO_CLASS = {
  static: "demo-static",
  live: "demo-live",
  placeholder: "demo-placeholder",
} as const;

/** A key path into a spec: object keys and array indexes, outermost first. */
export type SpecPath = readonly (string | number)[];

/** One place in an embedded spec that the mount script fills from a shared value block. */
export type DemoSharedRef = { path: SpecPath; hash: string };
