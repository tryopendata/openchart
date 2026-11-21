/**
 * The reader controls under a demo's stage, written at build time: the state
 * buttons, Replay, the download buttons, the event log and the polite region
 * that announces a switch or an edit. Every control ships `hidden`, and
 * scripts/demo-controls.ts reveals them once the stage is live, so a page
 * without JavaScript shows no dead control. This module also embeds the other
 * states' specs, without the data they repeat from the demo's own spec, and
 * checks a demo's controls when the page builds.
 */
import { isChartSpec, isLayerSpec, type VizSpec } from "@opendata-ai/openchart-core";
import type { DemoControls, DemoDef, DemoState } from "../../demos/types";
import { escapeHtml } from "./escape-html";
import { foldTargets } from "./fold-targets";
import { DEMO_ATTR, type EmbeddedDemoState, type SpecPath } from "./markup";
import { type SharedValue, splitSharedValues } from "./shared-values";
import { setValueAt } from "./spec-path";
import { InvalidDemoError, validateDemo } from "./validate";

/** The parts of a demo that decide its controls. */
export type ControlsDemo = Pick<DemoDef, "controls" | "mount">;

const EXPORT_LABELS = { svg: "Download SVG", png: "Download PNG", csv: "Download CSV" } as const;

/**
 * Whether the demo needs the controls script: it has controls, or it mounts in
 * edit mode, where each edit must be applied to its spec to stay put.
 */
export function needsControls(demo: ControlsDemo): boolean {
  return demo.controls !== undefined || demo.mount?.interaction === "edit";
}

function stateButtons(states: NonNullable<DemoControls["states"]>): string {
  const labels = [states.initialLabel, ...states.others.map(({ label }) => label)];
  const buttons = labels.map(
    (label, index) =>
      `<button type="button" class="demo-control" ${DEMO_ATTR.state}="${index}" aria-pressed="${index === 0}">${escapeHtml(label)}</button>`,
  );
  return `<div class="demo-states" role="group" aria-label="Chart states" hidden>${buttons.join("")}</div>`;
}

function actionButtons(controls: DemoControls): string {
  const replay = controls.replay
    ? `<button type="button" class="demo-control" ${DEMO_ATTR.replay} hidden>Replay</button>`
    : "";
  const downloads = (controls.exports ?? []).map(
    (format) =>
      `<button type="button" class="demo-control" ${DEMO_ATTR.exportFormat}="${format}" hidden>${EXPORT_LABELS[format]}</button>`,
  );
  const buttons = replay + downloads.join("");
  return buttons ? `<div class="demo-actions">${buttons}</div>` : "";
}

/** The row of buttons, or nothing when the demo has none. */
function buttonRow(controls: DemoControls): string {
  const states = controls.states ? stateButtons(controls.states) : "";
  const actions = actionButtons(controls);
  if (!states && !actions) return "";
  return `<div class="demo-controls-row">${states}${actions}</div>`;
}

/**
 * The event log in a frame that keeps its height while the log is hidden, so
 * revealing it moves nothing. The log scrolls inside the frame, so it takes focus.
 */
const eventLog = (controls: DemoControls) =>
  controls.eventLog
    ? `<div class="demo-events-frame"><ol class="demo-events" ${DEMO_ATTR.events} aria-label="Chart events, newest first" tabindex="0" hidden></ol></div>`
    : "";

/**
 * The controls bar for `figure.demo-figure`, between the stage and the
 * figcaption, or an empty string when the demo needs none.
 */
export function demoControlsHtml(demo: ControlsDemo): string {
  if (!needsControls(demo)) return "";
  const controls = demo.controls ?? {};
  const status = `<span class="sr-only" role="status" aria-live="polite" ${DEMO_ATTR.controlsStatus}></span>`;
  return `<div class="demo-controls" ${DEMO_ATTR.controls}>${buttonRow(controls)}${eventLog(controls)}${status}</div>`;
}

/** The other states as the `data-demo-states` script's JSON, and the shared value blocks they add to the page. */
export type EmbeddedStates = { json: string; values: SharedValue[] };

/** The state's spec with `null` wherever it repeats the demo's own bulky values, and those paths. */
function withoutRepeats(state: VizSpec, own: VizSpec): { spec: VizSpec; fromSpec: SpecPath[] } {
  const ownValues = new Map(
    foldTargets(own).map(({ path, value }) => [JSON.stringify(path), JSON.stringify(value)]),
  );
  const fromSpec = foldTargets(state)
    .filter(({ path, value }) => ownValues.get(JSON.stringify(path)) === JSON.stringify(value))
    .map(({ path }) => path);
  if (fromSpec.length === 0) return { spec: state, fromSpec };
  const spec = structuredClone(state);
  for (const path of fromSpec) setValueAt(spec, path, null);
  return { spec, fromSpec };
}

function embedState(
  state: DemoState,
  own: VizSpec,
  pageShared: Set<string> | undefined,
): { state: EmbeddedDemoState; values: SharedValue[] } {
  const { spec, fromSpec } = withoutRepeats(state.spec, own);
  if (!pageShared) return { state: { label: state.label, spec, fromSpec, shared: [] }, values: [] };
  const split = splitSharedValues(spec, pageShared);
  const embedded = {
    label: state.label,
    spec: JSON.parse(split.specJson),
    fromSpec,
    shared: split.refs,
  };
  return { state: embedded, values: split.values };
}

/**
 * The demo's other states, ready to embed: bulky values a state repeats from
 * the demo's own spec are left out and copied back in the browser, and large
 * values it does not repeat go through the page's shared value blocks when
 * `pageShared` is given (see shared-values.ts). Null when the demo has no states.
 *
 * @throws {FoldMarkerError} When a state's spec contains the text fold markers use.
 */
export function embeddedStates(
  controls: DemoControls | undefined,
  own: VizSpec,
  pageShared?: Set<string>,
): EmbeddedStates | null {
  const others = controls?.states?.others ?? [];
  if (others.length === 0) return null;
  const embedded = others.map((state) => embedState(state, own, pageShared));
  return {
    json: JSON.stringify(embedded.map(({ state }) => state)),
    values: embedded.flatMap(({ values }) => values),
  };
}

/**
 * Checks a demo's controls when its page builds: they need a chart or layer
 * spec, and every state's spec must pass the library's validation.
 *
 * @throws {InvalidDemoError} Naming the demo id, and the state label for a state that fails.
 */
export function validateDemoControls(demo: Pick<DemoDef, "id" | "spec" | "controls">): void {
  const { id, spec, controls } = demo;
  if (!controls) return;
  if (!isChartSpec(spec) && !isLayerSpec(spec)) {
    const type = String((spec as { type?: unknown }).type);
    throw new InvalidDemoError(id, [
      {
        path: "",
        code: "INVALID_TYPE",
        message: `Reader controls work on chart and layer specs only, and this spec has type "${type}".`,
        suggestion: "Remove `controls` from the demo, or show the chart as a chart or layer spec.",
      },
    ]);
  }
  for (const state of controls.states?.others ?? []) {
    validateDemo(`${id} (state "${state.label}")`, state.spec);
  }
}
