/**
 * Remembers whether the reader keeps demo code open. Each figure's code is a
 * `<details>` that the build writes closed, so it opens and closes without this
 * script. When the reader opens or closes one, the choice goes to sessionStorage,
 * and every page they load afterwards in this tab starts its demos that way.
 * The figures already on the page stay as they are, so nothing above or below
 * the reader jumps.
 */
import { DEMO_ATTR } from "../lib/demo/markup";

/** The sessionStorage key holding "open" or "closed". */
export const CODE_OPEN_STORAGE_KEY = "openchart:demo-code";

function readCodeOpen(): boolean {
  try {
    return globalThis.sessionStorage.getItem(CODE_OPEN_STORAGE_KEY) === "open";
  } catch {
    // Storage can be blocked (privacy settings, sandboxed frames); closed is the built state.
    return false;
  }
}

function writeCodeOpen(open: boolean): void {
  try {
    globalThis.sessionStorage.setItem(CODE_OPEN_STORAGE_KEY, open ? "open" : "closed");
  } catch {
    // Blocked storage only means the next page starts closed.
  }
}

/** Opens every demo's code when the reader left it open, and records each later toggle. */
export function setupDemoCodeToggle(doc: Document): void {
  const blocks = [...doc.querySelectorAll<HTMLDetailsElement>(`details[${DEMO_ATTR.code}]`)];
  if (blocks.length === 0) return;
  if (readCodeOpen()) for (const block of blocks) block.open = true;
  // The restore above fires `toggle` too; it writes back the stored state, which is harmless.
  for (const block of blocks) block.addEventListener("toggle", () => writeCodeOpen(block.open));
}
