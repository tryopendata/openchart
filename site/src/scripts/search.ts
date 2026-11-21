/**
 * The eager part of site search, loaded on every page by BaseLayout. It fills
 * the trigger's shortcut hint, wires the trigger, the shortcuts and the Close
 * button, then shows the trigger, whose box was already reserved. Opening is
 * synchronous: the dialog shows and the input takes focus in the same event, so
 * keystrokes typed while the dialog code loads land in the input (and iOS shows
 * its keyboard). The dialog code (search-dialog.ts) and Pagefind load with
 * dynamic imports on the first hover, focus or open of the trigger. The build
 * test holds this module, with its static imports, to 2 KB gzipped.
 */
import {
  currentPlatform,
  isApplePlatform,
  isTypingTarget,
  shortcutAction,
  shortcutHint,
} from "../lib/search/shortcuts";

type DialogModule = typeof import("./search-dialog");

let dialogModule: Promise<DialogModule | null> | undefined;

function setupSearch(): void {
  const trigger = document.querySelector<HTMLButtonElement>("[data-search-trigger]");
  const dialog = document.querySelector<HTMLDialogElement>("dialog[data-search]");
  const input = dialog?.querySelector<HTMLInputElement>("[data-search-input]");
  const status = dialog?.querySelector<HTMLElement>("[data-search-status]");
  if (!trigger || !dialog || !input) return;
  const mac = isApplePlatform(currentPlatform(navigator));
  const hint = trigger.querySelector("[data-search-hint]");
  if (hint) hint.textContent = shortcutHint(mac);
  trigger.setAttribute("aria-keyshortcuts", mac ? "Meta+K /" : "Control+K /");
  let opener: Element | null = null;

  /** Runs `use` with the dialog code. A failed import is forgotten, so the next use retries it. */
  const withDialogModule = (use: (module: DialogModule) => void) => {
    dialogModule ??= import("./search-dialog").catch((error: unknown) => {
      dialogModule = undefined;
      console.error("Search could not load its dialog code; opening search again retries.", error);
      if (status) {
        status.textContent = status.dataset.loadError ?? "";
        status.classList.remove("sr-only");
      }
      return null;
    });
    void dialogModule.then((module) => module && use(module));
  };

  const open = () => {
    if (dialog.open) return;
    opener = document.activeElement;
    dialog.showModal();
    input.focus();
    withDialogModule((module) => module.openSearch(dialog));
  };
  const prepare = () => withDialogModule((module) => module.prepareSearch(dialog));
  trigger.addEventListener("pointerenter", prepare, { once: true });
  trigger.addEventListener("focus", prepare, { once: true });
  trigger.addEventListener("click", open);
  dialog.querySelector("[data-search-close]")?.addEventListener("click", () => dialog.close());
  // Focus goes back where it was when search opened, unless that element is gone.
  dialog.addEventListener("close", () => {
    const back =
      opener instanceof HTMLElement && opener.isConnected && opener !== document.body
        ? opener
        : trigger;
    back.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    const action = shortcutAction(event, { mac, typing: isTypingTarget(event.target) });
    if (action === "toggle" && dialog.open) dialog.close();
    else if (action && !dialog.open) open();
    else return;
    event.preventDefault();
  });
  // Shown by global.css once ready; its box was reserved, so the header doesn't move.
  trigger.dataset.searchReady = "";
}

setupSearch();
