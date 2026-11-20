/**
 * The Copy button on each demo code panel. The buttons ship `hidden` so a page
 * without JavaScript shows no dead control; this reveals and wires them. A panel
 * that shows a shortened form of its code keeps the complete code in a
 * `<template>`, which is what gets copied. A failed copy says so on the button
 * for two seconds, and the code stays selectable for a manual copy.
 */
import { copyText } from "@steamfield/ui/copy";
import { DEMO_ATTR } from "../lib/demo/markup";

const FEEDBACK_MS = 2000;
const IDLE_LABEL = "Copy";

/** The complete code of a panel: its copy template when it has one, otherwise the shown code. */
function panelCode(panel: Element): string | undefined {
  const source = panel.querySelector<HTMLTemplateElement>(`template[${DEMO_ATTR.copySource}]`);
  if (source) return source.content.textContent ?? "";
  return panel.querySelector("pre")?.textContent ?? undefined;
}

async function copyPanel(button: HTMLButtonElement, code: string): Promise<void> {
  const copied = await copyText(code);
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
