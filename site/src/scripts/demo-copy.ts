/**
 * The Copy button on each demo code panel. The buttons ship `hidden` so a page
 * without JavaScript shows no dead control; this reveals and wires them. A panel
 * that shows a folded form of its code keeps a copy template in a `<template>`,
 * and Copy fills the template's folded values in from the figure's spec
 * (fold-fill.ts) before copying. A failed copy says so on the button for two
 * seconds, and the code stays selectable for a manual copy.
 */
import { copyText } from "@steamfield/ui/copy";
import { fillFolds } from "../lib/demo/fold-fill";
import { DEMO_ATTR, type SpecPath } from "../lib/demo/markup";
import { readFigureSpec } from "./demo-spec";

const FEEDBACK_MS = 2000;
const IDLE_LABEL = "Copy";

/** Fills a copy template's folded values in from the spec of the figure the panel belongs to. */
function filledTemplate(panel: Element, template: HTMLTemplateElement): string {
  const code = template.content.textContent ?? "";
  const folds = JSON.parse(template.getAttribute(DEMO_ATTR.copyFills) ?? "[]") as SpecPath[];
  if (folds.length === 0) return code;
  const figure = panel.closest(`[${DEMO_ATTR.figure}]`) ?? panel;
  return fillFolds(code, folds, readFigureSpec(figure));
}

/**
 * Reads the complete code of a panel at the moment Copy is pressed: its filled
 * copy template when it has one, otherwise the shown code. Undefined when the
 * panel has neither.
 */
function panelCode(panel: Element): (() => string) | undefined {
  const template = panel.querySelector<HTMLTemplateElement>(`template[${DEMO_ATTR.copySource}]`);
  if (template) return () => filledTemplate(panel, template);
  const shown = panel.querySelector("pre")?.textContent;
  return shown === undefined ? undefined : () => shown;
}

function figureId(button: Element): string {
  return (
    button.closest(`[${DEMO_ATTR.figure}]`)?.getAttribute(DEMO_ATTR.figure) ?? "(unknown demo)"
  );
}

async function copyPanel(button: HTMLButtonElement, code: () => string): Promise<void> {
  let copied = false;
  try {
    copied = await copyText(code());
  } catch (error) {
    console.error(`Demo "${figureId(button)}" could not assemble its code to copy.`, error);
  }
  button.textContent = copied ? "Copied" : "Copy failed";
  setTimeout(() => {
    button.textContent = IDLE_LABEL;
  }, FEEDBACK_MS);
}

/** Reveals and wires every demo panel's Copy button to copy that panel's complete code. */
export function setupDemoCopyButtons(doc: Document): void {
  for (const button of doc.querySelectorAll<HTMLButtonElement>(`[${DEMO_ATTR.copy}]`)) {
    const panel = button.closest(`[${DEMO_ATTR.panel}]`);
    const code = panel ? panelCode(panel) : undefined;
    if (code === undefined) continue;
    button.hidden = false;
    button.addEventListener("click", () => copyPanel(button, code));
  }
}
