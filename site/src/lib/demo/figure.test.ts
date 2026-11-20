// @vitest-environment node
/** The demo figure's HTML: the markup contract Demo.astro and the fence both render. */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
import { type DemoFigure, demoFigureHtml } from "./figure";

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
    ...overrides,
  };
}

async function render(figure: DemoFigure) {
  const html = await demoFigureHtml(figure);
  const doc = new new Window().DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const element = doc.querySelector("figure");
  if (!element) throw new Error("demoFigureHtml returned no <figure>");
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

  it("leaves the stage empty for a spec type with no static renderer", async () => {
    const figure = await render(figureFor({ id: fixtureTable.id, spec: fixtureTable.spec }));
    expect(figure.querySelector("[data-demo-stage]")?.children).toHaveLength(0);
  });
});
