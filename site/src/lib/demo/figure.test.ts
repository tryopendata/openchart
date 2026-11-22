// @vitest-environment node
/** The demo figure's HTML: the markup contract Demo.astro and the fence both render. */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { ownThemeFixture } from "../../demos/fixtures/controls";
import { fixtureTable } from "../../demos/fixtures/table";
import { basicChoropleth } from "../../demos/maps/choropleth";
import {
  bareStageHtml,
  type DemoFigure,
  demoFigureHtml,
  embeddedSpecHtml,
  stageContentHtml,
} from "./figure";
import { valueAt } from "./spec-path";

function figureFor(overrides: Partial<DemoFigure> = {}): DemoFigure {
  return {
    id: fixtureBar.id,
    spec: fixtureBar.spec,
    title: fixtureBar.title,
    source: fixtureBar.source,
    caption: fixtureBar.caption,
    height: 320,
    entrance: false,
    tabs: true,
    static: true,
    ...overrides,
  };
}

async function render(figure: DemoFigure) {
  const html = await demoFigureHtml(figure);
  const doc = new new Window().DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const element = doc.querySelector("div.demo");
  if (!element) throw new Error("demoFigureHtml returned no demo element");
  return element;
}

describe("demoFigureHtml", () => {
  it("renders the stage, the embedded spec, the code tabs and the caption", async () => {
    const figure = await render(figureFor());
    expect(figure.className).toBe("demo not-prose");
    expect(figure.getAttribute("data-demo")).toBe("fixtures/bar");
    expect(figure.hasAttribute("data-demo-entrance")).toBe(false);
    const stage = figure.querySelector("[data-demo-stage]");
    expect(stage?.getAttribute("style")).toBe("--demo-height: 320px");
    expect(
      [...(stage?.querySelectorAll("svg.demo-static") ?? [])].map((svg) =>
        svg.getAttribute("data-theme"),
      ),
    ).toEqual(["light", "dark"]);
    expect(figure.querySelector("[data-demo-code]")).not.toBeNull();
    // Reading order: a figure holding the stage then its caption, then the spec, then the code.
    expect([...figure.children].map((child) => child.tagName)).toEqual(["FIGURE", "SCRIPT", "DIV"]);
    expect(
      [...(figure.querySelector("figure")?.children ?? [])].map((child) => child.tagName),
    ).toEqual(["DIV", "FIGCAPTION"]);
    expect(figure.querySelector("figcaption")?.textContent).toBe(
      "Weekly orders by region. Source: Illustrative data.",
    );
  });

  it("keeps the embedded spec out of search and safe inside its script element", async () => {
    const spec = { ...fixtureBar.spec, title: "Ends </script> early?" } as VizSpec;
    const figure = await render(figureFor({ spec }));
    const script = figure.querySelector("script[data-demo-spec]");
    expect(script?.hasAttribute("data-pagefind-ignore")).toBe(true);
    expect(JSON.parse(script?.textContent ?? "")).toEqual(spec);
  });

  it("keeps the stage and the controls out of search, and the caption in", async () => {
    const figure = await render(figureFor({ controls: { replay: true } }));
    expect(figure.querySelector("[data-demo-stage]")?.hasAttribute("data-pagefind-ignore")).toBe(
      true,
    );
    expect(figure.querySelector("[data-demo-controls]")?.hasAttribute("data-pagefind-ignore")).toBe(
      true,
    );
    expect(figure.querySelector("figcaption")?.closest("[data-pagefind-ignore]")).toBeNull();
  });

  it("marks the entrance, links the source and leaves out tabs when asked", async () => {
    const figure = await render(
      figureFor({
        entrance: true,
        tabs: false,
        source: { label: "Census & survey", url: "https://example.com/?a=1&b=2" },
      }),
    );
    expect(figure.hasAttribute("data-demo-entrance")).toBe(true);
    expect(figure.querySelector("[data-demo-code]")).toBeNull();
    const link = figure.querySelector("figcaption a");
    expect(link?.getAttribute("href")).toBe("https://example.com/?a=1&b=2");
    expect(link?.textContent).toBe("Census & survey");
  });

  it.each([
    { name: "a spec type with no static renderer", overrides: { spec: fixtureTable.spec } },
    { name: "a demo that turns static rendering off", overrides: { static: false } },
  ])("shows a placeholder line and no static SVG for $name", async ({ overrides }) => {
    const figure = await render(figureFor({ title: "Orders & returns", ...overrides }));
    const stage = figure.querySelector("[data-demo-stage]");
    expect(stage?.querySelector("svg")).toBeNull();
    expect([...(stage?.children ?? [])].map((child) => child.outerHTML)).toEqual([
      '<p class="demo-placeholder" data-demo-placeholder="">Orders &amp; returns. This chart is drawn in the browser.</p>',
    ]);
  });

  it("writes a large shared value once per page and references it from every figure that uses it", async () => {
    const pageShared = new Set<string>();
    const shared = { spec: basicChoropleth.spec, static: false, tabs: false, pageShared };
    const first = await render(figureFor({ ...shared, id: "maps/first" }));
    const second = await render(figureFor({ ...shared, id: "maps/second" }));
    const blocks = [first, second].map((figure) => figure.querySelectorAll("[data-demo-shared]"));
    expect(blocks[0]?.length).toBeGreaterThan(0);
    expect(blocks[1]).toHaveLength(0);
    for (const figure of [first, second]) {
      const script = figure.querySelector("script[data-demo-spec]");
      const embedded = JSON.parse(script?.textContent ?? "") as { geo: { features: unknown } };
      expect(embedded.geo.features).toBeNull();
      const refs = JSON.parse(script?.getAttribute("data-demo-shared-refs") ?? "[]");
      expect(refs).toContainEqual({ path: ["geo", "features"], hash: expect.any(String) });
      for (const { path, hash } of refs) {
        const block = first.querySelector(`[data-demo-shared="${hash}"]`);
        expect(JSON.parse(block?.textContent ?? ""), path.join(".")).toEqual(
          valueAt(basicChoropleth.spec, path),
        );
      }
    }
  });

  it("lets the spec's own theme show in the static SVGs and marks the demo when pageTheme is false", async () => {
    const statics = (figure: Awaited<ReturnType<typeof render>>) =>
      [...figure.querySelectorAll("svg.demo-static")].map((svg) => svg.outerHTML).join("");
    const spec = ownThemeFixture.spec;
    const sitePainted = await render(figureFor({ spec }));
    const ownPainted = await render(figureFor({ spec, pageTheme: false }));
    expect(sitePainted.hasAttribute("data-demo-own-theme")).toBe(false);
    expect(statics(sitePainted)).toContain("Schibsted Grotesk");
    expect(ownPainted.hasAttribute("data-demo-own-theme")).toBe(true);
    expect(statics(ownPainted)).not.toContain("Schibsted Grotesk");
    // Broadsheet names no family of its own, so the library default (Inter) shows, on its newsprint paper.
    expect(statics(ownPainted)).toContain("Inter");
    expect(statics(ownPainted).toLowerCase()).toContain("#fffdf9");
  });

  it("lays the static SVGs out at the demo's width and caps the stage at it", async () => {
    const figure = await render(figureFor({ width: 360 }));
    const stage = figure.querySelector("[data-demo-stage]");
    expect(stage?.getAttribute("style")).toBe("--demo-height: 320px; --demo-width: 360px");
    expect(
      [...(stage?.querySelectorAll("svg.demo-static") ?? [])].map((svg) =>
        svg.getAttribute("viewBox"),
      ),
    ).toEqual(["0 0 360 320", "0 0 360 320"]);
  });

  it("writes the phone height beside the desktop height, so CSS reserves it before scripts run", async () => {
    const figure = await render(figureFor({ phoneHeight: 520, width: 360 }));
    const stage = figure.querySelector("[data-demo-stage]");
    expect(stage?.getAttribute("style")).toBe(
      "--demo-height: 320px; --demo-phone-height: 520px; --demo-width: 360px",
    );
  });

  it("adds a static pair laid out at phone size, shown in its own set, with its own ids", async () => {
    const figure = await render(figureFor({ phoneHeight: 520 }));
    const sets = [...figure.querySelectorAll("[data-demo-stage] > .demo-static-set")];
    expect(sets.map((set) => set.getAttribute("data-static-size"))).toEqual(["wide", "phone"]);
    const viewBoxes = (set: (typeof sets)[number] | undefined) =>
      [...(set?.querySelectorAll("svg.demo-static") ?? [])].map((svg) => [
        svg.getAttribute("data-theme"),
        svg.getAttribute("viewBox"),
      ]);
    expect(viewBoxes(sets[0])).toEqual([
      ["light", "0 0 720 320"],
      ["dark", "0 0 720 320"],
    ]);
    expect(viewBoxes(sets[1])).toEqual([
      ["light", "0 0 390 520"],
      ["dark", "0 0 390 520"],
    ]);
    const ids = [...figure.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("writes one static pair, with no sets, without a phone height", async () => {
    const figure = await render(figureFor());
    expect(figure.querySelector(".demo-static-set")).toBeNull();
    expect(figure.querySelectorAll("svg.demo-static")).toHaveLength(2);
  });

  it("writes the host options on the spec script only when the demo sets some", async () => {
    const script = async (overrides: Partial<DemoFigure>) =>
      (await render(figureFor(overrides))).querySelector("script[data-demo-spec]");
    const canvas = await script({ mount: { renderer: "canvas" } });
    expect(JSON.parse(canvas?.getAttribute("data-demo-mount") ?? "null")).toEqual({
      renderer: "canvas",
    });
    expect((await script({}))?.hasAttribute("data-demo-mount")).toBe(false);
    expect((await script({ mount: {} }))?.hasAttribute("data-demo-mount")).toBe(false);
  });

  it("passes an edit demo's interaction mode and edit handler in its framework code", async () => {
    const figure = await render(figureFor({ mount: { interaction: "edit" } }));
    const react = figure.querySelector('[data-demo-panel="react"]')?.textContent ?? "";
    expect(react).toContain('interaction="edit" onEdit={onEdit}');
    const vanilla = figure.querySelector('[data-demo-panel="vanilla"]')?.textContent ?? "";
    expect(vanilla).toContain('{ interaction: "edit", onEdit }');
  });

  it("embeds the whole spec when the page keeps no record of shared values", async () => {
    const figure = await render(
      figureFor({ spec: basicChoropleth.spec, static: false, tabs: false }),
    );
    const script = figure.querySelector("script[data-demo-spec]");
    expect(script?.hasAttribute("data-demo-shared-refs")).toBe(false);
    expect(JSON.parse(script?.textContent ?? "")).toEqual(basicChoropleth.spec);
  });
});

describe("a chart drawn without the figure", () => {
  const parse = (html: string) =>
    new new Window().DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;

  it("is a bare stage with the static SVGs or the placeholder, sized by the caller's class", () => {
    const content = stageContentHtml({
      spec: fixtureBar.spec,
      title: fixtureBar.title,
      domId: "d-tile",
      height: 180,
      width: 240,
      static: true,
      precision: 0,
    });
    const stage = parse(bareStageHtml(content, "tile-stage")).querySelector("[data-demo-stage]");
    expect(stage?.className).toBe("demo-stage tile-stage");
    expect(stage?.getAttribute("style")).toBeNull();
    const statics = [...(stage?.querySelectorAll("svg.demo-static") ?? [])];
    expect(statics.map((svg) => svg.getAttribute("data-theme"))).toEqual(["light", "dark"]);
    expect(statics.map((svg) => svg.getAttribute("viewBox"))).toEqual([
      "0 0 240 180",
      "0 0 240 180",
    ]);
    const table = stageContentHtml({
      spec: fixtureTable.spec,
      title: "Rows",
      domId: "t",
      height: 1,
      static: true,
    });
    expect(parse(table).querySelector("[data-demo-placeholder]")?.textContent).toBe(
      "Rows. This chart is drawn in the browser.",
    );
  });

  it("embeds its spec with shared values written once per page record", () => {
    const pageShared = new Set<string>();
    const first = parse(embeddedSpecHtml(basicChoropleth.spec, pageShared));
    const second = parse(embeddedSpecHtml(basicChoropleth.spec, pageShared));
    expect(first.querySelectorAll("[data-demo-shared]").length).toBeGreaterThan(0);
    expect(second.querySelectorAll("[data-demo-shared]")).toHaveLength(0);
    const whole = parse(embeddedSpecHtml(basicChoropleth.spec));
    expect(JSON.parse(whole.querySelector("script[data-demo-spec]")?.textContent ?? "")).toEqual(
      basicChoropleth.spec,
    );
  });
});

describe("demoFigureHtml on a blog post", () => {
  const blog = {
    credit: { href: "/docs/comparison/bar/", chartName: "bar chart" },
    staticWidth: 1024,
  };

  it("adds one crawlable credit line after the caption, linking to the chart type's docs page", async () => {
    const figure = await render(figureFor({ blog }));
    const credit = figure.querySelector("figure.demo-figure > p.figure-credit");
    expect(credit).not.toBeNull();
    expect(credit?.hasAttribute("data-pagefind-ignore")).toBe(true);
    expect(credit?.textContent).toContain("Made with OpenChart");
    const links = figure.querySelectorAll("a.figure-credit-link");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/docs/comparison/bar/");
    expect(links[0]?.textContent).toContain("bar chart");
    expect(figure.querySelector("figure")?.lastElementChild).toBe(credit);
  });

  it("reveals the figure's chrome but never hides the stage behind a motion role", async () => {
    const figure = await render(figureFor({ blog }));
    expect(figure.hasAttribute("data-reveal")).toBe(true);
    const stage = figure.querySelector("[data-demo-stage]");
    const moving = [...figure.querySelectorAll("[data-motion]")];
    expect(moving.length).toBeGreaterThan(0);
    expect(moving.filter((element) => stage && element.contains(stage))).toEqual([]);
    expect(stage?.hasAttribute("data-motion")).toBe(false);
  });

  it("lays its static SVGs out at the wide column's width", async () => {
    const wide = await render(figureFor({ blog }));
    const narrow = await render(figureFor());
    const widthOf = (element: Awaited<ReturnType<typeof render>>) =>
      element.querySelector("svg.demo-static")?.getAttribute("viewBox")?.split(/\s+/)[2];
    expect(widthOf(wide)).toBe("1024");
    expect(widthOf(narrow)).toBe("720");
  });

  it("keeps a demo's own width over the wide static width", async () => {
    const figure = await render(figureFor({ blog, width: 360 }));
    const viewBox = figure.querySelector("svg.demo-static")?.getAttribute("viewBox");
    expect(viewBox?.split(/\s+/)[2]).toBe("360");
  });

  it("as the hero, keeps the credit but paints in place with no entrance or reveal roles", async () => {
    const figure = await render(figureFor({ blog, hero: true, tabs: false, entrance: true }));
    expect(figure.hasAttribute("data-demo-entrance")).toBe(false);
    expect(figure.querySelector("a.figure-credit-link")).not.toBeNull();
    expect(figure.hasAttribute("data-reveal")).toBe(false);
    expect(figure.querySelector("[data-motion]")).toBeNull();
    expect(figure.querySelector("[data-demo-code]")).toBeNull();
  });

  it("as the hero, takes ids apart from the body's copy of the same demo", async () => {
    const idsOf = (element: Awaited<ReturnType<typeof render>>) =>
      [...element.querySelectorAll("[id]")].map((node) => node.id);
    const hero = idsOf(await render(figureFor({ blog, hero: true, tabs: false })));
    const body = idsOf(await render(figureFor({ blog })));
    expect(hero.length).toBeGreaterThan(0);
    expect(hero.filter((id) => body.includes(id))).toEqual([]);
  });

  it("writes none of the blog markup without the blog option", async () => {
    const figure = await render(figureFor());
    expect(figure.querySelector(".figure-credit")).toBeNull();
    expect(figure.hasAttribute("data-reveal")).toBe(false);
    expect(figure.querySelector("[data-motion]")).toBeNull();
  });
});
