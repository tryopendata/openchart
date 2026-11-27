/**
 * Narrows the library's edit mode to the one thing the edit section lets the
 * reader do: move the callout.
 *
 * The library has no option to limit which elements are editable: edit mode
 * makes the title, subtitle and every annotation selectable, opens a text
 * editor on double-click or Enter, deletes on Delete, adds a note on a
 * double-click in the plot, and steps through every element on Tab. The page
 * refuses all of those edits anyway (edit-state.ts), so offering them would
 * only promise what never happens. These capture-phase listeners on the chart's
 * box stop those gestures before the library sees them:
 *
 * - double-clicks, Enter, Delete and Backspace never reach the chart;
 * - presses on anything editable but the callout's label, and on the callout's
 *   connector and anchor handles, are dropped, so nothing else gets selected or
 *   dragged;
 * - Tab selects the callout, and the next Tab leaves the chart, so the callout
 *   is the chart's only stop; arriving on the chart from the keyboard selects it.
 *
 * The hover outlines and handles the library draws on the other elements are
 * hidden in landing-edit.css.
 */

/** What the guard needs from the chart. */
export type EditGuardChart = {
  /** Selects the callout (and focuses the chart). */
  selectCallout: () => void;
  /** Clears the selection. */
  deselect: () => void;
  /** True while the callout is selected. */
  calloutSelected: () => boolean;
};

/** The callout's label and the rest of its group: the only things a press may land on. */
const CALLOUT_SELECTOR = '[data-annotation-index="0"]';
/** Everything the library makes editable or draggable. */
const EDITABLE_SELECTOR =
  "[data-annotation-index], [data-chrome-key], .oc-legend, [data-legend-index], .oc-connector-handle, .oc-anchor-handle";
/** Parts of the callout that edit something other than its position. */
const CALLOUT_HANDLE_SELECTOR = ".oc-connector-handle, .oc-anchor-handle";
const BLOCKED_KEYS = new Set(["Enter", "Delete", "Backspace"]);
const PRESS_EVENTS = ["mousedown", "touchstart", "click"] as const;

/** True when a press on `target` would select or drag something other than the callout. */
function pressesSomethingElse(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(CALLOUT_HANDLE_SELECTOR)) return true;
  const editable = target.closest(EDITABLE_SELECTOR);
  return editable !== null && !editable.closest(CALLOUT_SELECTOR);
}

/** True when `target` is the chart's own SVG, the element that holds keyboard focus in edit mode. */
const isChartSvg = (target: EventTarget | null) =>
  target instanceof SVGSVGElement &&
  target.ownerSVGElement === null &&
  target.closest(".oc-chart-root") !== null;

/** Guards the chart inside `stage`; returns the teardown. */
export function guardEdits(stage: HTMLElement, chart: EditGuardChart): () => void {
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const onPress = (event: Event) => {
    if (pressesSomethingElse(event.target)) event.stopPropagation();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isChartSvg(event.target)) return;
    if (BLOCKED_KEYS.has(event.key)) return swallow(event);
    if (event.key !== "Tab") return;
    event.stopPropagation();
    if (!event.shiftKey && !chart.calloutSelected()) {
      event.preventDefault();
      chart.selectCallout();
      return;
    }
    // Leaving the chart either way: drop the selection and let the browser move focus on.
    chart.deselect();
  };
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target;
    if (isChartSvg(target) && (target as Element).matches(":focus-visible")) {
      if (!chart.calloutSelected()) chart.selectCallout();
    }
  };

  stage.addEventListener("dblclick", swallow, true);
  stage.addEventListener("keydown", onKeyDown, true);
  stage.addEventListener("focusin", onFocusIn);
  for (const type of PRESS_EVENTS) stage.addEventListener(type, onPress, true);
  return () => {
    stage.removeEventListener("dblclick", swallow, true);
    stage.removeEventListener("keydown", onKeyDown, true);
    stage.removeEventListener("focusin", onFocusIn);
    for (const type of PRESS_EVENTS) stage.removeEventListener(type, onPress, true);
  };
}
