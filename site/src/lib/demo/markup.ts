/**
 * The names in the demo figure's markup contract: the data attributes and
 * classes that the figure builder writes and the page scripts query. demo.css
 * and the hand-written fixture page use the same names as literals.
 */

/** The data attributes on a demo figure and its parts. */
export const DEMO_ATTR = {
  /** On the `<figure>`, holding the demo id. */
  figure: "data-demo",
  /** On the stage that holds the static SVGs and later the live chart. */
  stage: "data-demo-stage",
  /** On the `<script type="application/json">` holding the spec. */
  spec: "data-demo-spec",
  /** On the code block: the tab strip and the panels. */
  code: "data-demo-code",
  /** On each tab link, holding its framework id. */
  tab: "data-demo-tab",
  /** On each code panel, holding its framework id. */
  panel: "data-demo-panel",
  /** On each panel's Copy button. */
  copy: "data-demo-copy",
  /** On a panel's `<template>` holding the complete code its Copy button copies. */
  copySource: "data-demo-copy-source",
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
} as const;
