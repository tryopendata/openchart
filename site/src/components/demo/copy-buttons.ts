/**
 * The Copy button on each demo code panel. The buttons ship `hidden` so a page
 * without JavaScript shows no dead control; this reveals and wires them. A
 * failed copy says so on the button for two seconds, and the code stays
 * selectable for a manual copy.
 */
import { copyText } from "@steamfield/ui/copy";

const FEEDBACK_MS = 2000;
const IDLE_LABEL = "Copy";

async function copyPanel(button: HTMLButtonElement, code: Element): Promise<void> {
  const copied = await copyText(code.textContent ?? "");
  button.textContent = copied ? "Copied" : "Copy failed";
  setTimeout(() => {
    button.textContent = IDLE_LABEL;
  }, FEEDBACK_MS);
}

/** Reveals and wires every demo panel's Copy button to copy that panel's code. */
export function setupDemoCopyButtons(doc: Document): void {
  for (const button of doc.querySelectorAll<HTMLButtonElement>("[data-demo-copy]")) {
    const code = button.closest("[data-demo-panel]")?.querySelector("pre");
    if (!code) continue;
    button.hidden = false;
    button.addEventListener("click", () => copyPanel(button, code));
  }
}
