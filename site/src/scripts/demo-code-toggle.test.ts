// @vitest-environment node
/**
 * The Code disclosure and its remembered state, across page loads in one tab.
 * Each page is a fresh happy-dom window that runs the real head gate script,
 * then holds real demos; the pages share one sessionStorage, the way pages in a
 * browser tab do.
 */
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureBar } from "../demos/fixtures/bar";
import { demoFigureHtml } from "../lib/demo/figure";
import { CODE_OPEN_STORAGE_KEY, demoGateScript } from "../lib/demo/page-gate";
import { setupDemoCodeToggle } from "./demo-code-toggle";

const demo = (id: string) =>
  demoFigureHtml({
    id,
    spec: fixtureBar.spec,
    title: fixtureBar.title,
    source: fixtureBar.source,
    height: 320,
    entrance: true,
    tabs: true,
    static: false,
  });
const twoDemos = Promise.all([demo("fixtures/one"), demo("fixtures/two")]).then((html) =>
  html.join(""),
);

/** The tab's session storage, kept across the pages a test loads. */
let tabStorage = new Window().sessionStorage;

/** Loads a page the way the browser does: the head gate first, then the body, then demos.ts. */
async function loadPage(options: { scripts?: "on time" | "late"; storage?: Storage } = {}) {
  const window = new Window({ url: "https://openchart.example/docs/" });
  const storage = options.storage ?? (tabStorage as unknown as Storage);
  Object.defineProperty(window, "sessionStorage", { value: storage });
  window.eval(demoGateScript);
  // Scripts that arrive after the gate gave up find the page as it is without JavaScript.
  if (options.scripts === "late") {
    window.document.documentElement.removeAttribute("data-demo-gate");
  }
  window.document.body.innerHTML = await twoDemos;
  vi.stubGlobal("sessionStorage", storage);
  setupDemoCodeToggle(window.document as unknown as Document);
  return window;
}

const toggles = (window: Window) =>
  [...window.document.querySelectorAll("[data-demo-toggle]")] as unknown as HTMLButtonElement[];
const expanded = (window: Window) =>
  toggles(window).map((toggle) => toggle.getAttribute("aria-expanded"));

afterEach(() => {
  vi.unstubAllGlobals();
  tabStorage = new Window().sessionStorage;
});

describe("the Code disclosure", () => {
  it("starts every demo closed on a reader's first page, with a visible Code button naming its block", async () => {
    const window = await loadPage();
    expect(window.document.documentElement.getAttribute("data-demo-code-default")).toBe("closed");
    expect(expanded(window)).toEqual(["false", "false"]);
    for (const toggle of toggles(window)) {
      expect(toggle.hidden).toBe(false);
      expect(toggle.textContent).toBe("Code");
      const block = window.document.getElementById(toggle.getAttribute("aria-controls") ?? "");
      expect(block?.hasAttribute("data-demo-code")).toBe(true);
    }
  });

  it("opens one demo on a press, and every demo on the next page, leaving this page alone", async () => {
    const first = await loadPage();
    toggles(first)[0]?.click();
    expect(expanded(first)).toEqual(["true", "false"]);
    expect(tabStorage.getItem(CODE_OPEN_STORAGE_KEY)).toBe("open");
    const second = await loadPage();
    expect(second.document.documentElement.getAttribute("data-demo-code-default")).toBe("open");
    expect(expanded(second)).toEqual(["true", "true"]);
  });

  it("starts closed again after the reader closes one", async () => {
    toggles(await loadPage())[0]?.click();
    toggles(await loadPage())[1]?.click();
    expect(expanded(await loadPage())).toEqual(["false", "false"]);
  });

  it("starts closed and still opens and closes when storage is blocked", async () => {
    const blocked = {
      getItem() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      setItem() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    } as unknown as Storage;
    const window = await loadPage({ storage: blocked });
    expect(expanded(window)).toEqual(["false", "false"]);
    toggles(window)[0]?.click();
    expect(expanded(window)).toEqual(["true", "false"]);
  });

  it("leaves the Code buttons hidden when scripts arrive after the gate lifted, so the code just shows", async () => {
    const window = await loadPage({ scripts: "late" });
    expect(toggles(window).map((toggle) => toggle.hidden)).toEqual([true, true]);
  });
});
