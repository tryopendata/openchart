/**
 * The eager part of site search, loaded on every page by BaseLayout. It fills
 * the trigger's shortcut hint, wires the trigger and the keyboard shortcuts, and
 * then shows the trigger, whose box was already reserved. The dialog code
 * (search-dialog.ts) and Pagefind load with dynamic imports: on the first hover
 * or focus of the trigger, or on the first open. The build test holds this
 * module, with its static imports, to 2 KB gzipped.
 */
import {
  isApplePlatform,
  isTypingTarget,
  shortcutAction,
  shortcutHint,
} from "../lib/search/shortcuts";

type DialogModule = typeof import("./search-dialog");

let dialogModule: Promise<DialogModule> | undefined;

/** Runs `use` with the dialog code, importing it on first call. */
function withDialogModule(use: (module: DialogModule) => void): void {
  dialogModule ??= import("./search-dialog");
  dialogModule.then(use, (error: unknown) => {
    console.error(
      "Search could not load its dialog code, so the Search button does nothing.",
      error,
    );
  });
}

function setupSearch(): void {
  const trigger = document.querySelector<HTMLButtonElement>("[data-search-trigger]");
  const dialog = document.querySelector<HTMLDialogElement>("dialog[data-search]");
  if (!trigger || !dialog) return;
  const mac = isApplePlatform(navigator.platform);
  const hint = trigger.querySelector("[data-search-hint]");
  if (hint) hint.textContent = shortcutHint(mac);
  trigger.setAttribute("aria-keyshortcuts", mac ? "Meta+K /" : "Control+K /");

  const open = () => withDialogModule((module) => module.openSearch(dialog, trigger));
  const prepare = () => withDialogModule((module) => module.prepareSearch(dialog, trigger));
  trigger.addEventListener("pointerenter", prepare, { once: true });
  trigger.addEventListener("focus", prepare, { once: true });
  trigger.addEventListener("click", open);
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
