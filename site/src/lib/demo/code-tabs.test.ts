// @vitest-environment node
/** The demo code tabs: what each panel shows, what it copies, and how its tokens get their colors. */
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
import { basicChoropleth } from "../../demos/maps/choropleth";
import { codeTabsHtml } from "./code-tabs";
import { fillFolds } from "./fold-fill";
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
/** What the Copy button copies: the panel's template with its folded values filled in. */
function filled(block: Element, id: string, spec: unknown): string {
  const template = panel(block, id)?.querySelector("template");
  if (!template) throw new Error(`The ${id} panel has no copy template`);
  const folds = JSON.parse(template.getAttribute("data-demo-copy-fills") ?? "[]");
  return fillFolds(template.content.textContent ?? "", folds, spec);
}

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
  });

  it("closes the code behind a Show code control, with one hidden Copy beside it", async () => {
    const { block } = await codeBlock();
    expect(block.tagName).toBe("DETAILS");
    expect(block.hasAttribute("open")).toBe(false);
    const toggle = block.querySelector(":scope > summary");
    // demo.css shows one label at a time: Show code while closed, Hide code while open.
    expect([...(toggle?.children ?? [])].map((label) => label.textContent)).toEqual([
      "Show code",
      "Hide code",
    ]);
    const toolbar = block.parentElement;
    const copies = [...(toolbar?.querySelectorAll("button[data-demo-copy]") ?? [])];
    expect(copies.map((button) => [button.textContent, button.hasAttribute("hidden")])).toEqual([
      ["Copy", true],
    ]);
    expect(block.contains(copies[0] ?? null)).toBe(false);
    const status = toolbar?.querySelector("[data-demo-copy-status]");
    expect(status?.getAttribute("aria-live")).toBe("polite");
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

  it("keeps a copy template per framework panel that fills back to the complete code", async () => {
    const { block } = await codeBlock();
    const full = frameworkSnippets(fixtureBar.spec);
    for (const id of FRAMEWORK_PANELS) {
      expect(filled(block, id, fixtureBar.spec), id).toBe(full[id]);
      expect(copied(block, id), id).not.toContain('"North"');
    }
  });

  it("folds a map's geography in the Spec panel too, keeping its rows written out", async () => {
    const { block } = await codeBlock(basicChoropleth.spec);
    const spec = shown(block, "spec") ?? "";
    expect(spec).toMatch(/"features": \{\/\* TopoJSON, \d+ arcs; Copy includes it \*\/\}/);
    expect(spec).not.toContain('"arcs"');
    const firstRow = JSON.stringify((basicChoropleth.spec as { data: unknown[] }).data[0]);
    expect(spec.replace(/\s+/g, "")).toContain(firstRow.replace(/\s+/g, ""));
    expect(JSON.parse(filled(block, "spec", basicChoropleth.spec))).toEqual(basicChoropleth.spec);
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
    expect(shown(block, "react")).toContain('"data": [/* 3 rows,');
    expect(filled(block, "react", fixtureTable.spec)).toBe(
      frameworkSnippets(fixtureTable.spec).react,
    );
  });
});
