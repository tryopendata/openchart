// @vitest-environment node
/** The demo code tabs: what each panel shows, what it copies, and how its tokens get their colors. */
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
import { codeTabsHtml } from "./code-tabs";
import { frameworkSnippets } from "./snippets";

const FRAMEWORK_PANELS = ["react", "vue", "svelte", "vanilla"] as const;

async function codeBlock(spec = fixtureBar.spec) {
  const html = await codeTabsHtml("d-fixtures-bar", spec);
  const parser = new new Window().DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html") as unknown as Document;
  const block = doc.querySelector("[data-demo-code]");
  if (!block) throw new Error("codeTabsHtml returned no [data-demo-code] block");
  return { html, block };
}

const panel = (block: Element, id: string) => block.querySelector(`[data-demo-panel="${id}"]`);
const shown = (block: Element, id: string) => panel(block, id)?.querySelector("pre")?.textContent;
const copied = (block: Element, id: string) =>
  panel(block, id)?.querySelector("template")?.content.textContent;

describe("codeTabsHtml", () => {
  it("links five tabs to five panels, Spec first and current", async () => {
    const { block } = await codeBlock();
    const tabs = [...block.querySelectorAll("[data-demo-tab]")];
    expect(tabs.map((tab) => tab.getAttribute("data-demo-tab"))).toEqual([
      "spec",
      ...FRAMEWORK_PANELS,
    ]);
    expect(tabs.map((tab) => tab.getAttribute("href"))).toEqual(
      tabs.map((tab) => `#d-fixtures-bar-code-${tab.getAttribute("data-demo-tab")}`),
    );
    expect(tabs[0]?.getAttribute("aria-current")).toBe("true");
    expect(block.querySelectorAll("[data-demo-panel] button[data-demo-copy]")).toHaveLength(5);
  });

  it("shows the data rows in the Spec panel only and folds them in the framework panels", async () => {
    const { block } = await codeBlock();
    expect(JSON.parse(shown(block, "spec") ?? "")).toEqual(fixtureBar.spec);
    expect(panel(block, "spec")?.querySelector("template")).toBeNull();
    for (const id of FRAMEWORK_PANELS) {
      expect(shown(block, id), id).toContain("const data = [/* 6 rows,");
      expect(shown(block, id), id).not.toContain('"North"');
    }
  });

  it("keeps each framework panel's complete, runnable code for its Copy button", async () => {
    const { block } = await codeBlock();
    const full = frameworkSnippets(fixtureBar.spec);
    for (const id of FRAMEWORK_PANELS) expect(copied(block, id), id).toBe(full[id]);
  });

  it("colors tokens through classes its own stylesheet defines, with no inline token styles", async () => {
    const { html, block } = await codeBlock();
    expect(html).not.toMatch(/style="[^"]*--shiki-/);
    const css = block.querySelector("style")?.textContent ?? "";
    const classes = new Set(
      [...block.querySelectorAll("pre span[class]:not(.line)")].map((span) => span.className),
    );
    expect(classes.size).toBeGreaterThan(1);
    for (const name of classes) {
      expect(css, name).toMatch(new RegExp(`\\.${name}\\{--shiki-light:#\\w+;--shiki-dark:#\\w+`));
    }
  });

  it("keeps the code block out of the search index", async () => {
    const { block } = await codeBlock();
    expect(block.hasAttribute("data-pagefind-ignore")).toBe(true);
  });

  it("folds a small inline dataset too, naming its row count", async () => {
    const { block } = await codeBlock(fixtureTable.spec);
    expect(shown(block, "react")).toContain("const data = [/* 3 rows,");
    expect(copied(block, "react")).toBe(frameworkSnippets(fixtureTable.spec).react);
  });
});
