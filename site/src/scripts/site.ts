/**
 * The one module script every page loads. It isn't an island: docs pages ship no
 * hydrated component, so the theme toggle, copy buttons, the outline highlight and
 * the sidebar position are plain DOM code. Each part does nothing on a page
 * without its markup. Code block copy buttons share the demos' copy behaviour
 * and look (`wireCopyButton` in scripts/demo-copy.ts, the `copy-button` class).
 */

import { spyToc } from "@steamfield/ui/docs";
import { DEMO_ATTR } from "../lib/demo/markup";
import { wireCopyButton } from "./demo-copy";

const THEME_KEY = "theme";
/** How long a button says "Copied" or "Copy failed" before its label returns. */
const FEEDBACK_MS = 2000;
/** How long an inline code pill shows its "Copied" tip. */
const INLINE_TIP_MS = 1200;

function setupThemeToggle() {
  const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!toggle) return;
  const root = document.documentElement;
  const sync = () => toggle.setAttribute("aria-pressed", String(root.classList.contains("dark")));
  // Shown by global.css once ready; its box was reserved, so the header doesn't move.
  toggle.dataset.themeReady = "";
  sync();
  toggle.addEventListener("click", () => {
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    sync();
  });
}

/**
 * Runs `copy` on each click of `button` and says how it went for two seconds before
 * the button's original label returns. `copy` is called synchronously in the click,
 * so it can reach the clipboard while the click still counts as user activation.
 */
function onCopyClick(button: HTMLButtonElement, copy: () => Promise<void>) {
  const label = button.textContent;
  let restore: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener("click", async () => {
    clearTimeout(restore);
    try {
      await copy();
      button.textContent = "Copied";
    } catch (error) {
      // The text stays on the page to select by hand; the console keeps the cause.
      console.warn("Copying failed", error);
      button.textContent = "Copy failed";
    }
    clearTimeout(restore);
    restore = setTimeout(() => {
      button.textContent = label;
    }, FEEDBACK_MS);
  });
}

/** Adds a Copy button, and the region that announces it, to every Markdown code block outside a demo. */
function setupCodeCopy() {
  for (const frame of document.querySelectorAll<HTMLElement>(".code-frame")) {
    const code = frame.querySelector("code");
    if (!code || frame.closest(`[${DEMO_ATTR.figure}]`)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "Copy";
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    frame.append(button, status);
    const title = frame.querySelector("figcaption")?.textContent;
    wireCopyButton(button, {
      read: () => code.textContent ?? "",
      status,
      copiedMessage: () => (title ? `Copied ${title}.` : "Copied the code."),
      context: title ? `The code block "${title}"` : "A code block",
    });
  }
}

/** The page's Markdown export as text; a non-ok response is a failure. */
async function fetchMarkdown(href: string): Promise<string> {
  const response = await fetch(href);
  if (!response.ok) throw new Error(`GET ${href} returned ${response.status}`);
  return response.text();
}

/**
 * Copies the Markdown export. Safari drops the click's user activation across a
 * network await, so where ClipboardItem exists the clipboard write starts at once
 * with the fetch as a pending promise; elsewhere writeText runs after the fetch.
 */
function copyMarkdown(href: string): Promise<void> {
  const text = fetchMarkdown(href);
  if (typeof ClipboardItem === "undefined") {
    return text.then((markdown) => navigator.clipboard.writeText(markdown));
  }
  const blob = text.then((markdown) => new Blob([markdown], { type: "text/plain" }));
  return navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
}

/** Shows "Copy page" and wires it to copy the page's Markdown export. */
function setupCopyPage() {
  const button = document.querySelector<HTMLButtonElement>("[data-copy-page]");
  const href = button?.dataset.copyPage;
  if (!button || !href) return;
  button.hidden = false;
  onCopyClick(button, () => copyMarkdown(href));
}

/** The inline code a click landed on, unless it is a heading, link or code block's. */
function copyableCode(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const code = target.closest<HTMLElement>(".prose code");
  if (!code || code.closest("pre, a, h1, h2, h3, h4, h5, h6")) return null;
  return code;
}

/**
 * Click an inline code pill in docs prose to copy its text. A click that ends a
 * text selection is left alone, and a polite live region announces the copy.
 * global.css styles the pills as copyable only once the article carries
 * data-copy-inline, so without JavaScript they stay plain text.
 */
function setupInlineCodeCopy() {
  const article = document.querySelector<HTMLElement>("article:has(.prose)");
  if (!article || !navigator.clipboard) return;
  article.dataset.copyInline = "";
  const live = document.createElement("div");
  live.className = "sr-only";
  live.setAttribute("role", "status");
  document.body.append(live);
  article.addEventListener("click", async (event) => {
    const code = copyableCode(event.target);
    if (!code || !window.getSelection()?.isCollapsed) return;
    try {
      await navigator.clipboard.writeText(code.textContent ?? "");
    } catch (error) {
      console.warn("Copying inline code failed", error);
      return;
    }
    code.dataset.copied = "";
    live.textContent = "Copied";
    setTimeout(() => {
      delete code.dataset.copied;
      live.textContent = "";
    }, INLINE_TIP_MS);
  });
}

/** Marks the outline link for the section being read, in every outline on the page. */
function setupOutlineSpy() {
  // One spy per list: the outline column and the sidebar's nested outline carry the
  // same hashes, and a spy keeps one link per hash.
  for (const list of document.querySelectorAll("[data-toc]")) {
    spyToc(list, { linkSelector: "a[href^='#']" });
  }
}

/** Scrolls the sticky docs rail, not the page, so the current page's link is in view. */
function setupSidebarScroll() {
  const rail = document.querySelector<HTMLElement>("[data-docs-rail]");
  const link = rail?.querySelector<HTMLElement>('nav[aria-label="Docs"] a[aria-current="page"]');
  if (!rail || !link) return;
  const box = rail.getBoundingClientRect();
  const at = link.getBoundingClientRect();
  if (at.bottom > box.bottom) rail.scrollTop += at.bottom - box.bottom + box.height / 3;
}

setupThemeToggle();
setupCodeCopy();
setupCopyPage();
setupInlineCodeCopy();
setupOutlineSpy();
setupSidebarScroll();
