/**
 * The Copy button in each demo figure's toolbar. It ships `hidden` so a page
 * without JavaScript shows no dead control; this reveals and wires it. Copy
 * works whether or not the code is shown: it copies the panel of the chosen tab
 * (framework-choice.ts writes the choice on the code block; Spec until one is
 * made). A panel that shows a folded form of its code keeps a copy template in
 * a `<template>`, and Copy fills the template's folded values in from the
 * figure's spec (fold-fill.ts) before copying. The button says Copied or Copy
 * failed for two seconds, and the figure's live region announces the same.
 * `wireCopyButton` is that behaviour on its own, for any copy button on a page.
 */
import { copyText } from "@steamfield/ui/copy";
import { fillFolds } from "../lib/demo/fold-fill";
import { DEFAULT_FRAMEWORK } from "../lib/demo/framework-choice";
import { DEMO_ATTR, type SpecPath } from "../lib/demo/markup";
import { readFigureSpec } from "./demo-spec";

const FEEDBACK_MS = 2000;
const IDLE_LABEL = "Copy";

/** Fills a copy template's folded values in from the figure's spec. */
function filledTemplate(figure: Element, template: HTMLTemplateElement): string {
  const code = template.content.textContent ?? "";
  const folds = JSON.parse(template.getAttribute(DEMO_ATTR.copyFills) ?? "[]") as SpecPath[];
  if (folds.length === 0) return code;
  return fillFolds(code, folds, readFigureSpec(figure));
}

/** The id of the tab the reader has chosen, read when Copy is pressed. */
function chosenTab(figure: Element): string {
  const code = figure.querySelector(`[${DEMO_ATTR.code}]`);
  return code?.getAttribute(DEMO_ATTR.choice) ?? DEFAULT_FRAMEWORK;
}

function chosenPanel(figure: Element): Element | null {
  return figure.querySelector(`[${DEMO_ATTR.panel}="${chosenTab(figure)}"]`);
}

/**
 * The complete code of the chosen panel: its filled copy template when it has
 * one, otherwise the shown code.
 *
 * @throws {Error} When the figure has no panel for the chosen tab.
 */
function chosenCode(figure: Element): string {
  const panel = chosenPanel(figure);
  if (!panel) throw new Error("The figure has no code panel for the chosen tab.");
  const template = panel.querySelector<HTMLTemplateElement>(`template[${DEMO_ATTR.copySource}]`);
  if (template) return filledTemplate(figure, template);
  return panel.querySelector("pre")?.textContent ?? "";
}

/** The chosen tab's label for the announcement, such as "React". */
function chosenLabel(figure: Element): string {
  return figure.querySelector(`[${DEMO_ATTR.tab}="${chosenTab(figure)}"]`)?.textContent ?? "chosen";
}

/** What a copy button copies and how it reports, for `wireCopyButton`. */
export type CopySource = {
  /** The text to copy, read at the moment of the click. May throw; the button then says Copy failed. */
  read: () => string;
  /** The polite live region that announces the outcome, if the button has one. */
  status?: Element | null;
  /** The announcement after a copy, such as "Copied the React code." Defaults to "Copied." */
  copiedMessage?: () => string;
  /** Names the source in the console when `read` throws, such as 'Demo "maps/basic"'. */
  context: string;
};

/**
 * Reveals a copy button and copies `source.read()` through `@steamfield/ui/copy`
 * on each click. The button says Copied or Copy failed for two seconds, and the
 * status region, when given, announces the same. Every copy button on a docs
 * page goes through here, so they all behave and read alike.
 */
export function wireCopyButton(button: HTMLButtonElement, source: CopySource): void {
  let restore: ReturnType<typeof setTimeout> | undefined;
  button.hidden = false;
  button.addEventListener("click", async () => {
    let copied = false;
    try {
      copied = await copyText(source.read());
    } catch (error) {
      console.error(`${source.context} could not assemble its code to copy.`, error);
    }
    button.textContent = copied ? "Copied" : "Copy failed";
    if (source.status) {
      source.status.textContent = copied
        ? (source.copiedMessage?.() ?? "Copied.")
        : "Copy failed. Select the code to copy it.";
    }
    // A second press inside the window restarts it rather than being cut short.
    clearTimeout(restore);
    restore = setTimeout(() => {
      button.textContent = IDLE_LABEL;
      if (source.status) source.status.textContent = "";
    }, FEEDBACK_MS);
  });
}

/** Reveals and wires every demo figure's Copy button to copy the chosen tab's complete code. */
export function setupDemoCopyButtons(doc: Document): void {
  for (const button of doc.querySelectorAll<HTMLButtonElement>(`[${DEMO_ATTR.copy}]`)) {
    const figure = button.closest(`[${DEMO_ATTR.figure}]`);
    if (!figure?.querySelector(`[${DEMO_ATTR.panel}]`)) continue;
    const id = figure.getAttribute(DEMO_ATTR.figure) ?? "(unknown demo)";
    wireCopyButton(button, {
      read: () => chosenCode(figure),
      status: figure.querySelector(`[${DEMO_ATTR.copyStatus}]`),
      copiedMessage: () => `Copied the ${chosenLabel(figure)} code.`,
      context: `Demo "${id}"`,
    });
  }
}
