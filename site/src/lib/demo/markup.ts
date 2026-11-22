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
  /** On the demo's outer `<div class="demo">`, which holds the figure, the spec and the code toolbar; holds the demo id. */
  figure: "data-demo",
  /** On the stage that holds the static SVGs and later the live chart. */
  stage: "data-demo-stage",
  /**
   * On a stage whose live chart sets its own height: the stage starts at the
   * demo's height and grows with the chart (facets on a phone, folded notes)
   * instead of scrolling it. Only charts, layers and tables (see figure.ts).
   */
  fit: "data-demo-fit",
  /** On the paragraph a stage without a static SVG shows until its live chart mounts. */
  placeholder: "data-demo-placeholder",
  /** On the `<script type="application/json">` holding the spec. */
  spec: "data-demo-spec",
  /** On the spec script, holding the JSON list of `DemoSharedRef` to fill in before mounting. */
  sharedRefs: "data-demo-shared-refs",
  /** On a page's `<script type="application/json">` holding one shared value, keyed by its hash. */
  shared: "data-demo-shared",
  /**
   * On the code block holding the tab strip and the panels. Without JavaScript it
   * shows; with it, demo.css closes it until the reader opens it (see `open`).
   */
  code: "data-demo-code",
  /** On the Code disclosure button, which carries `aria-expanded` and `aria-controls`. */
  toggle: "data-demo-toggle",
  /**
   * On a code block the reader opened or closed on this page, "true" or "false".
   * Without it the block follows the page default (`DEMO_PAGE_ATTR.codeDefault`).
   */
  open: "data-demo-open",
  /** On each tab link, holding its framework id. */
  tab: "data-demo-tab",
  /** On each code panel, holding its framework id. */
  panel: "data-demo-panel",
  /**
   * On the demo's one Copy button, in the toolbar beside Code. It copies
   * the chosen tab's panel, and ships `hidden` until the script wires it.
   */
  copy: "data-demo-copy",
  /** On the polite live region that announces the outcome of a copy. */
  copyStatus: "data-demo-copy-status",
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
  /** On `.demo` when the spec's own theme shows: the site chart theme is not laid over it. */
  ownTheme: "data-demo-own-theme",
  /** On the spec script, holding the JSON `DemoMountOptions` (renderer, interaction) the live mount passes on. */
  mountOptions: "data-demo-mount",
  /** On the controls bar inside `figure.demo-figure`, between the stage and the figcaption. */
  controls: "data-demo-controls",
  /** On a `<script type="application/json">` holding the other states' specs. */
  states: "data-demo-states",
  /** On each state button, holding its index; 0 is the demo's own `spec`. */
  state: "data-demo-state",
  /** On the Replay button. */
  replay: "data-demo-replay",
  /** On each download button, holding its format ("svg", "png" or "csv"). */
  exportFormat: "data-demo-export",
  /** On the event log `<ol>`. */
  events: "data-demo-events",
  /** On the polite live region in the controls bar that announces a state switch or an edit's outcome. */
  controlsStatus: "data-demo-controls-status",
} as const;

/**
 * One other state of a demo as the `data-demo-states` script holds it (see controls.ts).
 * `spec` is the state's spec with `null` in each place filled before use: from the
 * demo's own spec for each path in `fromSpec`, where the state repeats it, and
 * from a shared value block for each of `shared`.
 */
export type EmbeddedDemoState = {
  label: string;
  spec: unknown;
  fromSpec: SpecPath[];
  shared: DemoSharedRef[];
};

/**
 * Attributes on `<html>`. The demo gate script (demo-gate.ts) sets the first two
 * in the head, before first paint; demos.ts sets `ready` when it starts. Without
 * `ready` in time, the gate takes the first two away again, so a page whose
 * scripts never arrive looks like a page without JavaScript.
 */
export const DEMO_PAGE_ATTR = {
  /** Scripts are expected: demo.css hides held static charts and closes code blocks. */
  gate: "data-demo-gate",
  /** "open" or "closed": the reader's remembered choice for code blocks on this page. */
  codeDefault: "data-demo-code-default",
  /** demos.ts is running. */
  ready: "data-demo-ready",
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
