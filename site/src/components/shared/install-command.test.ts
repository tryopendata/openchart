// @vitest-environment node
/**
 * Two InstallCommands on one page, rendered from the real component and wired
 * by its script: each switches on its own, Copy copies the command on show, and
 * switching clears a failed copy's message. The clipboard is the one thing
 * faked, since the browser owns it. Astro renders the component only in the
 * node environment, so the DOM is a happy-dom Window installed as the globals.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import InstallCommand from "./InstallCommand.astro";
import { wireInstallCommands } from "./install-command";

const COMMANDS = [
  { label: "npm", command: "npm install @opendata-ai/openchart-react" },
  { label: "bun", command: "bun add @opendata-ai/openchart-react" },
  { label: "pnpm", command: "pnpm add @opendata-ai/openchart-react" },
];

let markup = "";

beforeAll(async () => {
  const container = await AstroContainer.create();
  const render = (id: string) =>
    container.renderToString(InstallCommand, { props: { id, commands: COMMANDS } });
  markup = (await render("first")) + (await render("second"));
});

let unwire = () => {};

/** Installs a fresh happy-dom window as the browser globals the scripts read. */
function installDom() {
  const window = new Window({ url: "https://openchart.test/" });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("navigator", window.navigator);
  vi.stubGlobal("location", window.location);
  vi.stubGlobal("history", window.history);
  const globals = [
    "HTMLElement",
    "HTMLDetailsElement",
    "Element",
    "Node",
    "Range",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
    "MutationObserver",
  ] as const;
  for (const name of globals) vi.stubGlobal(name, window[name]);
  vi.stubGlobal("getSelection", () => window.getSelection());
  return window;
}

function mount() {
  installDom();
  document.body.innerHTML = markup;
  unwire = wireInstallCommands(document);
  const [first, second] = [...document.querySelectorAll<HTMLElement>("[data-install-command]")];
  if (!first || !second) throw new Error("Expected two install commands in the rendered markup.");
  return { first, second };
}

const tab = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (node) => node.textContent?.trim() === label,
  );

/** The command text of the panel on show. */
const shown = (root: HTMLElement) =>
  root.querySelector('[role="tabpanel"]:not([hidden]) code')?.textContent?.trim();

const copyButton = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('[role="tabpanel"]:not([hidden]) [data-copy-command]');

function stubClipboard(writeText: (text: string) => Promise<void>) {
  const fake = vi.fn(writeText);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: fake }, configurable: true });
  return fake;
}

afterEach(() => {
  unwire();
  vi.unstubAllGlobals();
});

describe("InstallCommand", () => {
  it("switches each command on its own", () => {
    const { first, second } = mount();
    expect([shown(first), shown(second)]).toEqual([COMMANDS[0]?.command, COMMANDS[0]?.command]);
    tab(first, "pnpm")?.click();
    expect(tab(first, "pnpm")?.getAttribute("aria-selected")).toBe("true");
    expect([shown(first), shown(second)]).toEqual([COMMANDS[2]?.command, COMMANDS[0]?.command]);
  });

  it("copies the command on show", async () => {
    const { first } = mount();
    const writeText = stubClipboard(async () => {});
    tab(first, "bun")?.click();
    copyButton(first)?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(COMMANDS[1]?.command);
  });

  it("clears a failed copy's message when the reader switches managers", async () => {
    const { first } = mount();
    stubClipboard(async () => {
      throw new Error("Clipboard blocked");
    });
    // The library falls back to execCommand, which happy-dom lacks; make it fail too.
    document.execCommand = () => false;
    copyButton(first)?.click();
    const result = () =>
      first.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) [data-copy-result]');
    await vi.waitFor(() => expect(result()?.dataset.state).toBe("failed"));
    const failedPanel = result();
    tab(first, "bun")?.click();
    expect(failedPanel?.dataset.state).toBeUndefined();
    expect(failedPanel?.textContent).toBe("");
  });
});
