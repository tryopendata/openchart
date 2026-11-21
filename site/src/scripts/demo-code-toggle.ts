/**
 * The Code disclosure on each demo. The head gate (lib/demo/page-gate.ts) has
 * already closed or opened every block before first paint from the reader's
 * remembered choice; this reveals each Code button, keeps its `aria-expanded`
 * in step, and records the reader's own presses in sessionStorage so the next
 * page starts the same way. Only a press is recorded, and the blocks already on
 * the page stay as they are, so nothing above or below the reader jumps. When
 * the gate has lifted (scripts arrived late), the code is already showing and
 * the buttons stay hidden.
 */
import { DEMO_ATTR, DEMO_PAGE_ATTR } from "../lib/demo/markup";
import { CODE_OPEN_STORAGE_KEY } from "../lib/demo/page-gate";

function writeCodeOpen(open: boolean): void {
  try {
    globalThis.sessionStorage.setItem(CODE_OPEN_STORAGE_KEY, open ? "open" : "closed");
  } catch {
    // Blocked storage only means the next page starts closed.
  }
}

function toggleFor(block: Element): HTMLButtonElement | null {
  return block.ownerDocument.querySelector(`[${DEMO_ATTR.toggle}][aria-controls="${block.id}"]`);
}

/** Opens or closes one code block and keeps its Code button's state in step. Records nothing. */
export function setCodeOpen(block: Element, open: boolean): void {
  block.setAttribute(DEMO_ATTR.open, String(open));
  toggleFor(block)?.setAttribute("aria-expanded", String(open));
}

/** Reveals every Code button with its block's current state and wires it to open and close the block. */
export function setupDemoCodeToggle(doc: Document): void {
  const root = doc.documentElement;
  if (!root.hasAttribute(DEMO_PAGE_ATTR.gate)) return;
  const openByDefault = root.getAttribute(DEMO_PAGE_ATTR.codeDefault) === "open";
  for (const toggle of doc.querySelectorAll<HTMLButtonElement>(`[${DEMO_ATTR.toggle}]`)) {
    const block = doc.getElementById(toggle.getAttribute("aria-controls") ?? "");
    if (!block) continue;
    toggle.setAttribute("aria-expanded", String(openByDefault));
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setCodeOpen(block, open);
      writeCodeOpen(open);
    });
  }
}
