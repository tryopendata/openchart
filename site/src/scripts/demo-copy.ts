/**
 * Copy buttons: `wireCopyButton` is the one copy behaviour on the site's docs
 * pages, used by each demo's toolbar here and by the prose code blocks in
 * site.ts. A demo's Copy works whether or not its code is shown: it copies the
 * panel of the chosen tab (framework-choice.ts writes the choice on the code
 * block; Spec until one is made). A panel that shows a folded form of its code
 * keeps a copy template in a `<template>`, and Copy fills the template's folded
 * values in from the demo's spec (fold-fill.ts) before copying. When copying
 * fails, the demo opens its code and selects it for a manual copy.
 */
import { copyText } from "@steamfield/ui/copy";
import { fillFolds } from "../lib/demo/fold-fill";
import { DEFAULT_FRAMEWORK } from "../lib/demo/framework-choice";
import { DEMO_ATTR, type SpecPath } from "../lib/demo/markup";
import { setCodeOpen } from "./demo-code-toggle";
import { readFigureSpec } from "./demo-spec";

const FEEDBACK_MS = 2000;
const IDLE_LABEL = "Copy";
const FAILED_MESSAGE = "Copy failed. The code is selected; copy it with your keyboard.";

/** What a copy button copies and how it reports, for `wireCopyButton`. */
export type CopySource = {
  /** The text to copy, read at the moment of the click. May throw; the button then says Copy failed. */
  read: () => string;
  /** The polite live region that announces the outcome, if the button has one. */
  status?: Element | null;
  /** The announcement after a copy, read at the click, such as "Copied the React code." Defaults to "Copied." */
  copiedMessage?: () => string;
  /** Shows the text for a manual copy after a failure and returns what to announce. */
  onFailure?: () => string;
  /** Names the source in the console when `read` throws, such as 'Demo "maps/basic"'. */
  context: string;
};

/**
 * Reveals a copy button and copies `source.read()` through `@steamfield/ui/copy`
 * on each click. The button says Copied or Copy failed for two seconds, and the
 * status region, when given, announces the same. The region is cleared at each
 * press, so a repeated copy is announced again.
 */
export function wireCopyButton(button: HTMLButtonElement, source: CopySource): void {
  let restore: ReturnType<typeof setTimeout> | undefined;
  button.hidden = false;
  button.addEventListener("click", async () => {
    if (source.status) source.status.textContent = "";
    let copied = false;
    let message = "Copied.";
    try {
      // Read before awaiting, so a tab chosen while the copy runs can't change what is announced.
      const text = source.read();
      message = source.copiedMessage?.() ?? message;
      copied = await copyText(text);
    } catch (error) {
      console.error(`${source.context} could not assemble its code to copy.`, error);
    }
    button.textContent = copied ? "Copied" : "Copy failed";
    if (source.status) {
      source.status.textContent = copied ? message : (source.onFailure?.() ?? FAILED_MESSAGE);
    }
    // A second press inside the window restarts it rather than being cut short.
    clearTimeout(restore);
    restore = setTimeout(() => {
      button.textContent = IDLE_LABEL;
      if (source.status) source.status.textContent = "";
    }, FEEDBACK_MS);
  });
}

/** Fills a copy template's folded values in from the demo's spec. */
function filledTemplate(figure: Element, template: HTMLTemplateElement): string {
  const code = template.content.textContent ?? "";
  const folds = JSON.parse(template.getAttribute(DEMO_ATTR.copyFills) ?? "[]") as SpecPath[];
  if (folds.length === 0) return code;
  return fillFolds(code, folds, readFigureSpec(figure));
}

/** The id of the tab the reader has chosen. */
function chosenTab(figure: Element): string {
  const code = figure.querySelector(`[${DEMO_ATTR.code}]`);
  return code?.getAttribute(DEMO_ATTR.choice) ?? DEFAULT_FRAMEWORK;
}

function chosenPanel(figure: Element): Element | null {
  return figure.querySelector(`[${DEMO_ATTR.panel}="${chosenTab(figure)}"]`);
}

const copyTemplateOf = (panel: Element | null) =>
  panel?.querySelector<HTMLTemplateElement>(`template[${DEMO_ATTR.copySource}]`) ?? null;

/**
 * The complete code of the chosen panel: its filled copy template when it has
 * one, otherwise the shown code.
 *
 * @throws {Error} When the demo has no panel for the chosen tab.
 */
function chosenCode(figure: Element): string {
  const panel = chosenPanel(figure);
  if (!panel) throw new Error(`The demo has no code panel for the "${chosenTab(figure)}" tab.`);
  const template = copyTemplateOf(panel);
  if (template) return filledTemplate(figure, template);
  return panel.querySelector("pre")?.textContent ?? "";
}

/** The chosen tab's label for the announcement, such as "React". */
function chosenLabel(figure: Element): string {
  return figure.querySelector(`[${DEMO_ATTR.tab}="${chosenTab(figure)}"]`)?.textContent ?? "chosen";
}

/** Opens the demo's code and selects the chosen panel's code, then says what the reader can do. */
function offerManualCopy(figure: Element): string {
  const block = figure.querySelector(`[${DEMO_ATTR.code}]`);
  if (block) setCodeOpen(block, true);
  const panel = chosenPanel(figure);
  const pre = panel?.querySelector("pre");
  const selection = figure.ownerDocument.defaultView?.getSelection();
  if (pre && selection) selection.selectAllChildren(pre);
  if (!copyTemplateOf(panel)) return FAILED_MESSAGE;
  return chosenTab(figure) === "spec"
    ? "Copy failed. The code shown is abbreviated, so it can't be copied in full by hand."
    : "Copy failed. The code shown is abbreviated; the Spec tab shows the complete spec.";
}

/** Reveals and wires every demo's Copy button to copy the chosen tab's complete code. */
export function setupDemoCopyButtons(doc: Document): void {
  for (const button of doc.querySelectorAll<HTMLButtonElement>(`[${DEMO_ATTR.copy}]`)) {
    const figure = button.closest(`[${DEMO_ATTR.figure}]`);
    if (!figure?.querySelector(`[${DEMO_ATTR.panel}]`)) continue;
    const id = figure.getAttribute(DEMO_ATTR.figure) ?? "(unknown demo)";
    wireCopyButton(button, {
      read: () => chosenCode(figure),
      status: figure.querySelector(`[${DEMO_ATTR.copyStatus}]`),
      copiedMessage: () => `Copied the ${chosenLabel(figure)} code.`,
      onFailure: () => offerManualCopy(figure),
      context: `Demo "${id}"`,
    });
  }
}
