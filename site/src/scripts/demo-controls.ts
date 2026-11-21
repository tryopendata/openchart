/**
 * Wires a demo's reader controls (lib/demo/controls.ts writes them): the state
 * buttons move the live chart between states with the library's `update`, so
 * its update transition plays; Replay mounts the chart afresh so its entrance
 * plays again; the download buttons export the live chart; and the event log
 * lists what the chart emits, newest first. In edit mode each edit is applied
 * to the current spec with `applyEditTransaction` and drawn with `update`.
 *
 * demos.ts owns the mount and loads this module with `import()` only for demos
 * that have controls. The controls reach the chart through a `LiveHandle`, and
 * hand demos.ts the interaction mode and handlers every mount must pass on.
 */
import {
  applyEditTransaction,
  type ChartEventHandlers,
  type DataRow,
  type EditTransaction,
  type ElementRef,
  type VizSpec,
} from "@opendata-ai/openchart-core";
import type { ChartInstance, InteractionMode } from "@opendata-ai/openchart-vanilla";
import { DEMO_ATTR, type EmbeddedDemoState } from "../lib/demo/markup";
import { setValueAt, valueAt } from "../lib/demo/spec-path";
import { DemoSpecError, readFigureSpec, readMountOptions } from "./demo-spec";

/** What demos.ts gives the controls: the live chart, the demo's current spec, and two ways to redraw it. */
export type LiveHandle = {
  /** The live chart, or null while the demo is not mounted (not reached yet, or evicted). */
  instance(): ChartInstance | null;
  /** The spec the demo shows now. Later mounts (theme change, eviction, Replay) draw this one. */
  spec(): VizSpec;
  /** Makes `spec` the demo's current spec and moves the live chart to it with `update`. */
  update(spec: VizSpec): void;
  /** Makes `spec` the demo's current spec and mounts the chart afresh, playing the entrance when `entrance` is set. */
  remount(spec: VizSpec, options: { entrance: boolean }): void;
};

/** The wired controls: what every mount of the demo passes to the library, and a way to show the controls. */
export type WiredControls = {
  /** Set whenever handlers are attached, so attaching them never switches the mode. */
  interaction?: InteractionMode;
  handlers: ChartEventHandlers;
  /** Shows the controls. demos.ts calls it each time the stage goes live. */
  reveal(): void;
};

/** The event log keeps this many entries. */
const LOG_LIMIT = 8;
const FEEDBACK_MS = 2000;
/** The download has started well before this; the blob URL can go. */
const REVOKE_URL_MS = 10_000;
const MIME_TYPES = { svg: "image/svg+xml", png: "image/png", csv: "text/csv" } as const;
type ExportFormat = keyof typeof MIME_TYPES;

const isExportFormat = (value: string | null): value is ExportFormat =>
  value !== null && value in MIME_TYPES;

/** Says something once in the controls' polite region. */
type Announce = (text: string) => void;
/** Adds one line to the event log. */
type LogEvent = (text: string) => void;

function announcer(bar: Element): Announce {
  const region = bar.querySelector(`[${DEMO_ATTR.controlsStatus}]`);
  return (text) => {
    if (region) region.textContent = text;
  };
}

/** Prepends entries to the event log and drops the oldest past LOG_LIMIT; a no-op without a log. */
function eventLogger(log: HTMLOListElement | null): LogEvent {
  return (text) => {
    if (!log) return;
    const entry = log.ownerDocument.createElement("li");
    entry.textContent = text;
    log.prepend(entry);
    while (log.children.length > LOG_LIMIT) log.lastElementChild?.remove();
  };
}

// --- States -------------------------------------------------------------

function sharedValue(doc: Document, hash: string): unknown {
  const block = doc.querySelector(`script[${DEMO_ATTR.shared}="${hash}"]`);
  if (!block)
    throw new DemoSpecError(`The page has no shared value block ${hash} for a demo state.`);
  return JSON.parse(block.textContent ?? "");
}

/** A state's complete spec: the embedded one with its repeated and shared values filled in. */
function resolveState(demo: HTMLElement, state: EmbeddedDemoState, own: VizSpec): VizSpec {
  const spec = structuredClone(state.spec);
  for (const path of state.fromSpec) setValueAt(spec, path, structuredClone(valueAt(own, path)));
  for (const { path, hash } of state.shared) {
    setValueAt(spec, path, sharedValue(demo.ownerDocument, hash));
  }
  return spec as VizSpec;
}

/**
 * Every state's spec, the demo's own first, in button order.
 *
 * @throws {DemoSpecError} When the demo has state buttons but no states script, or a shared block is missing.
 * @throws {SyntaxError} When the states script is not valid JSON.
 */
function readStateSpecs(demo: HTMLElement): VizSpec[] {
  const own = readFigureSpec(demo);
  const script = demo.querySelector(`script[${DEMO_ATTR.states}]`);
  if (!script) throw new DemoSpecError("The demo has state buttons but no embedded states.");
  const states = JSON.parse(script.textContent ?? "") as EmbeddedDemoState[];
  return [own, ...states.map((state) => resolveState(demo, state, own))];
}

/** Each state button moves the chart to its state, marks itself pressed and says what is showing. */
function wireStates(demo: HTMLElement, bar: Element, handle: LiveHandle, announce: Announce) {
  const buttons = [...bar.querySelectorAll<HTMLButtonElement>(`[${DEMO_ATTR.state}]`)];
  if (buttons.length === 0) return;
  const specs = readStateSpecs(demo);
  for (const button of buttons) {
    const spec = specs[Number(button.getAttribute(DEMO_ATTR.state))];
    if (!spec)
      throw new DemoSpecError(`The demo has no state ${button.getAttribute(DEMO_ATTR.state)}.`);
    button.addEventListener("click", () => {
      handle.update(structuredClone(spec));
      for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
      announce(`Showing: ${button.textContent}`);
    });
  }
}

// --- Downloads -----------------------------------------------------------

/** The download's file name: the demo id with its slash as a hyphen, then the extension. */
const downloadName = (demoId: string, format: ExportFormat) =>
  `${demoId.replaceAll("/", "-")}.${format}`;

async function exportedFile(instance: ChartInstance | null, format: ExportFormat): Promise<Blob> {
  if (!instance) throw new Error("The chart is not live, so there is nothing to export.");
  if (format === "png") return instance.export("png");
  const text = format === "svg" ? instance.export("svg") : instance.export("csv");
  return new Blob([text], { type: MIME_TYPES[format] });
}

function saveFile(doc: Document, file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = doc.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_MS);
}

/** Each download button exports the live chart; a failure shows on the button for two seconds. */
function wireDownloads(demo: HTMLElement, bar: Element, handle: LiveHandle, announce: Announce) {
  const id = demo.getAttribute(DEMO_ATTR.figure) ?? "(unknown demo)";
  for (const button of bar.querySelectorAll<HTMLButtonElement>(`[${DEMO_ATTR.exportFormat}]`)) {
    const format = button.getAttribute(DEMO_ATTR.exportFormat);
    if (!isExportFormat(format)) continue;
    const label = button.textContent;
    let restore: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener("click", async () => {
      try {
        const file = await exportedFile(handle.instance(), format);
        saveFile(demo.ownerDocument, file, downloadName(id, format));
      } catch (error) {
        console.error(`Demo "${id}" could not export ${format.toUpperCase()}.`, error);
        button.textContent = "Export failed";
        announce(`Export failed: the ${format.toUpperCase()} file could not be made.`);
        clearTimeout(restore);
        restore = setTimeout(() => {
          button.textContent = label;
        }, FEEDBACK_MS);
      }
    });
  }
}

// --- Events and edits ---------------------------------------------------

const MAX_VALUE_CHARS = 40;

function shortValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text;
}

/** A row as "field value" pairs, the first three fields. */
function describeDatum(datum: DataRow): string {
  return Object.entries(datum)
    .slice(0, 3)
    .map(([field, value]) => `${field} ${shortValue(value)}`)
    .join(", ");
}

const describeElement = (element: ElementRef) => element.path ?? element.type;

function describeEdit({ ops }: EditTransaction): string {
  return ops
    .map(({ op, path, value }) =>
      value === undefined ? `${op} ${path}` : `${op} ${path} ${shortValue(value)}`,
    )
    .join("; ");
}

/** Handlers that write each reader-driven event to the log. Hover is left out: it would push everything else off. */
function loggingHandlers(log: LogEvent): ChartEventHandlers {
  return {
    onMarkClick: ({ datum }) => log(`onMarkClick: ${describeDatum(datum)}`),
    onMarkFocus: ({ datum, description }) =>
      log(`onMarkFocus: ${description ?? describeDatum(datum)}`),
    onLegendToggle: (series, visible) =>
      log(`onLegendToggle: ${series} ${visible ? "shown" : "hidden"}`),
    onAnnotationClick: (_annotation, _event, element) =>
      log(`onAnnotationClick: ${describeElement(element)}`),
    onSelect: (element) => log(`onSelect: ${describeElement(element)}`),
    onDeselect: (element) => log(`onDeselect: ${describeElement(element)}`),
  };
}

/** Applies each edit to the current spec and draws the result; a rejected edit changes nothing. */
function editHandler(handle: LiveHandle, log: LogEvent, announce: Announce) {
  return (transaction: EditTransaction) => {
    const result = applyEditTransaction(handle.spec(), transaction);
    if (!result.ok) {
      log(`Edit rejected: ${result.error.path} ${result.error.reason}`);
      announce("Edit rejected.");
      return;
    }
    handle.update(result.spec);
    log(`onEdit: ${describeEdit(transaction)}`);
    announce("Edit applied.");
  };
}

/** Shows every control in the bar. */
function revealControls(bar: Element): void {
  const controls = bar.querySelectorAll<HTMLElement>(
    `[role="group"], [${DEMO_ATTR.replay}], [${DEMO_ATTR.exportFormat}], [${DEMO_ATTR.events}]`,
  );
  for (const control of controls) control.hidden = false;
}

/**
 * Wires the controls bar of one demo. Call it before the demo first mounts:
 * the result carries the interaction mode and handlers each mount passes on.
 * With an event log the mode is always explicit (`mount.interaction`, else
 * "read"), so attaching the log's handlers never switches it.
 *
 * @throws {DemoSpecError} When the demo has no controls bar, or its states can't be read.
 * @throws {SyntaxError} When the states script or the host options are not valid JSON.
 */
export function wireDemoControls(demo: HTMLElement, handle: LiveHandle): WiredControls {
  const bar = demo.querySelector(`[${DEMO_ATTR.controls}]`);
  if (!bar) throw new DemoSpecError("The demo has no controls bar.");
  const announce = announcer(bar);
  const logElement = bar.querySelector<HTMLOListElement>(`[${DEMO_ATTR.events}]`);
  const log = eventLogger(logElement);
  wireStates(demo, bar, handle, announce);
  wireDownloads(demo, bar, handle, announce);
  bar.querySelector(`[${DEMO_ATTR.replay}]`)?.addEventListener("click", () => {
    handle.remount(handle.spec(), { entrance: true });
  });
  const { interaction } = readMountOptions(demo);
  const handlers: ChartEventHandlers = logElement ? loggingHandlers(log) : {};
  if (interaction === "edit") handlers.onEdit = editHandler(handle, log, announce);
  return {
    interaction: interaction ?? (logElement ? "read" : undefined),
    handlers,
    reveal: () => revealControls(bar),
  };
}
