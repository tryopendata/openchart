// @vitest-environment node
/**
 * The remembered Show code state, across page loads in one tab. Each page is a
 * fresh happy-dom window holding real demo figures, sharing one sessionStorage
 * the way pages in a browser tab do.
 */
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureBar } from "../demos/fixtures/bar";
import { demoFigureHtml } from "../lib/demo/figure";
import { CODE_OPEN_STORAGE_KEY, setupDemoCodeToggle } from "./demo-code-toggle";

const figure = (id: string) =>
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
const twoFigures = Promise.all([figure("fixtures/one"), figure("fixtures/two")]).then((html) =>
  html.join(""),
);

/** The tab's session storage, kept across the pages a test loads. */
let tabStorage = new Window().sessionStorage;

async function loadPage() {
  const window = new Window();
  window.document.body.innerHTML = await twoFigures;
  vi.stubGlobal("sessionStorage", tabStorage);
  setupDemoCodeToggle(window.document as unknown as Document);
  return window;
}

const blocks = (window: Window) =>
  [
    ...window.document.querySelectorAll("details[data-demo-code]"),
  ] as unknown as HTMLDetailsElement[];
const openStates = (window: Window) => blocks(window).map((block) => block.open);

/** Opens or closes one block as a click on its summary would, and waits for the toggle to land. */
async function setOpen(block: HTMLDetailsElement, open: boolean) {
  const toggled = new Promise((resolve) =>
    block.addEventListener("toggle", resolve, { once: true }),
  );
  block.open = open;
  await toggled;
}

afterEach(() => {
  vi.unstubAllGlobals();
  tabStorage = new Window().sessionStorage;
});

describe("the remembered Show code state", () => {
  it("starts every demo closed on a reader's first page", async () => {
    expect(openStates(await loadPage())).toEqual([false, false]);
  });

  it("opens every demo on the next page once the reader opened one, and leaves this page alone", async () => {
    const first = await loadPage();
    await setOpen(blocks(first)[0] as HTMLDetailsElement, true);
    expect(openStates(first)).toEqual([true, false]);
    expect(tabStorage.getItem(CODE_OPEN_STORAGE_KEY)).toBe("open");
    expect(openStates(await loadPage())).toEqual([true, true]);
  });

  it("starts closed again after the reader closes one", async () => {
    const first = await loadPage();
    await setOpen(blocks(first)[0] as HTMLDetailsElement, true);
    const second = await loadPage();
    await setOpen(blocks(second)[1] as HTMLDetailsElement, false);
    expect(openStates(await loadPage())).toEqual([false, false]);
  });

  it("starts closed and keeps working when storage is blocked", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      setItem() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    const window = new Window();
    window.document.body.innerHTML = await twoFigures;
    setupDemoCodeToggle(window.document as unknown as Document);
    expect(openStates(window)).toEqual([false, false]);
    await setOpen(blocks(window)[0] as HTMLDetailsElement, true);
    expect(openStates(window)).toEqual([true, false]);
  });
});
