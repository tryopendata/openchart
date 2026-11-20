// @vitest-environment node
/**
 * The demo Copy buttons, wired on a page that holds a real demo figure. The
 * figure is highlighted in Node (Shiki needs Node's fetch), then loaded into a
 * happy-dom page whose clipboard stands in for the browser's.
 */
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureBar } from "../demos/fixtures/bar";
import { demoFigureHtml } from "../lib/demo/figure";
import { frameworkSnippets } from "../lib/demo/snippets";
import { setupDemoCopyButtons } from "./demo-copy";

const figureHtml = demoFigureHtml({
  id: fixtureBar.id,
  spec: fixtureBar.spec,
  title: fixtureBar.title,
  source: fixtureBar.source,
  height: 320,
  entrance: false,
  tabs: true,
});

async function pageWithFigure() {
  const window = new Window();
  window.document.body.innerHTML = await figureHtml;
  vi.stubGlobal("navigator", window.navigator);
  setupDemoCopyButtons(window.document as unknown as Document);
  return window;
}

function copyButton(window: Window, panel: string) {
  const button = window.document.querySelector(`[data-demo-panel="${panel}"] [data-demo-copy]`);
  if (!button) throw new Error(`No Copy button in the ${panel} panel`);
  return button as unknown as HTMLButtonElement;
}

async function clickCopy(window: Window, panel: string): Promise<HTMLButtonElement> {
  const button = copyButton(window, panel);
  button.click();
  await vi.waitFor(() => expect(button.textContent).not.toBe("Copy"));
  return button;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("demo Copy buttons", () => {
  it("are revealed once the script runs", async () => {
    const window = await pageWithFigure();
    const buttons = [...window.document.querySelectorAll("[data-demo-copy]")];
    expect(buttons.map((button) => (button as unknown as HTMLButtonElement).hidden)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("copy the Spec panel as the JSON it shows", async () => {
    const window = await pageWithFigure();
    expect((await clickCopy(window, "spec")).textContent).toBe("Copied");
    expect(JSON.parse(await window.navigator.clipboard.readText())).toEqual(fixtureBar.spec);
  });

  it("copy a framework panel's complete code, data rows included", async () => {
    const window = await pageWithFigure();
    await clickCopy(window, "vue");
    expect(await window.navigator.clipboard.readText()).toBe(
      frameworkSnippets(fixtureBar.spec).vue,
    );
  });

  it("say Copy failed when the clipboard refuses", async () => {
    const window = await pageWithFigure();
    vi.spyOn(window.navigator.clipboard, "writeText").mockRejectedValue(new Error("Not allowed"));
    expect((await clickCopy(window, "react")).textContent).toBe("Copy failed");
  });
});
