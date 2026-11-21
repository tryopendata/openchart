// @vitest-environment node
/** The demo code tabs: what each panel shows, what it copies, and how its tokens get their colors. */
import type { VizSpec } from "@opendata-ai/openchart-core";
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

/** The bar fixture with `count` rows, region and orders numbered from 0. */
const barWithRows = (count: number): VizSpec => ({
  ...fixtureBar.spec,
  data: Array.from({ length: count }, (_, i) => ({ region: `Region ${i}`, orders: i })),
});

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

  it("leads with a Code disclosure and one Copy, in reading order, before the code they act on", async () => {
    const { block } = await codeBlock();
    const toolbar = block.parentElement;
    const row = toolbar?.firstElementChild;
    expect([...(toolbar?.children ?? [])]).toEqual([row, block]);
    const controls = [...(row?.querySelectorAll("button") ?? [])].map((button) => ({
      name: button.textContent,
      hidden: button.hasAttribute("hidden"),
      expanded: button.getAttribute("aria-expanded"),
      controls: button.getAttribute("aria-controls"),
    }));
    expect(controls).toEqual([
      { name: "Code", hidden: true, expanded: "false", controls: block.id },
      { name: "Copy", hidden: true, expanded: null, controls: null },
    ]);
    expect(row?.querySelector("[data-demo-copy-status]")?.getAttribute("aria-live")).toBe("polite");
  });

  it("makes each panel's code a keyboard-scrollable region", async () => {
    const { block } = await codeBlock();
    const pres = [...block.querySelectorAll("[data-demo-panel] pre")];
    expect(pres.map((pre) => pre.getAttribute("tabindex"))).toEqual(["0", "0", "0", "0", "0"]);
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

  it("writes out all 12 rows of a list at the cap, as plain JSON with nothing to fill", async () => {
    const spec = barWithRows(12);
    const { block } = await codeBlock(spec);
    expect(JSON.parse(shown(block, "spec") ?? "")).toEqual(spec);
    expect(panel(block, "spec")?.querySelector("template")).toBeNull();
    expect(shown(block, "react")).toContain(
      "/* 12 rows, as in the Spec tab; Copy includes them */",
    );
  });

  it("shows the first 6 rows of a longer list and a comment counting the rest", async () => {
    const spec = barWithRows(3108);
    const { block } = await codeBlock(spec);
    const lines = (shown(block, "spec") ?? "").split("\n");
    const start = lines.indexOf('  "data": [');
    expect(lines.slice(start, start + 27).join("\n")).toBe(
      [
        '  "data": [',
        ...[0, 1, 2, 3, 4, 5].map(
          (i) => `    {\n      "region": "Region ${i}",\n      "orders": ${i}\n    },`,
        ),
        "    // … 3,102 more rows; Copy includes them",
        "  ],",
      ].join("\n"),
    );
    expect(shown(block, "spec")).not.toContain('"Region 6"');
    expect(shown(block, "react")).toContain("const data = [/* 3,108 rows; Copy includes them */];");
  });

  it("copies a long list's complete spec from the figure's spec, keeping no second copy of the rows", async () => {
    const spec = barWithRows(13);
    const { block } = await codeBlock(spec);
    expect(JSON.parse(filled(block, "spec", spec))).toEqual(spec);
    expect(copied(block, "spec")).not.toContain('"Region 0"');
    expect(filled(block, "vanilla", spec)).toBe(frameworkSnippets(spec).vanilla);
  });

  it("folds a small inline dataset too, naming its row count", async () => {
    const { block } = await codeBlock(fixtureTable.spec);
    expect(shown(block, "react")).toContain('"data": [/* 3 rows,');
    expect(filled(block, "react", fixtureTable.spec)).toBe(
      frameworkSnippets(fixtureTable.spec).react,
    );
  });
});
