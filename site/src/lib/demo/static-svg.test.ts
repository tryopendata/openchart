// @vitest-environment node
/** Build-time static rendering, run with no DOM as the Astro build runs it. */
import type { RaceSpec } from "@opendata-ai/openchart-core";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
import { staticSvg } from "./static-svg";

const SIZE = { width: 720, height: 320 };
const salesRace: RaceSpec = {
  type: "race",
  mark: "bar",
  data: [
    { year: 2000, name: "Early leader", sales: 10 },
    { year: 2000, name: "Last & <leader>", sales: 1 },
    { year: 2001, name: "Last & <leader>", sales: 2 },
    { year: 2002, name: "Last & <leader>", sales: 20 },
  ],
  encoding: {
    time: { field: "year", type: "quantitative", format: "d" },
    key: { field: "name" },
    value: { field: "sales", format: "$.0f" },
  },
  chrome: { title: "Sales" },
  race: { top: 1 },
};

function readRace(spec: RaceSpec, dark = false) {
  const markup = staticSvg(spec, { ...SIZE, idPrefix: `race-${dark ? "d" : "l"}`, dark });
  const doc = new new Window().DOMParser().parseFromString(markup ?? "", "text/html");
  const svg = doc.querySelector(`svg.demo-static[data-theme='${dark ? "dark" : "light"}']`);
  if (!svg) throw new Error("Expected a race SVG in the requested theme.");
  return svg;
}

function elementIds(svg: string | null): string[] {
  return [...(svg ?? "").matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("staticSvg", () => {
  it("renders a bar chart to a themed static SVG with no DOM present", () => {
    expect(typeof document).toBe("undefined");
    const svg = staticSvg(fixtureBar.spec, { ...SIZE, idPrefix: "d-fixtures-bar-l", dark: false });
    expect(svg).toMatch(/^<svg\b[^>]*\sclass="demo-static oc-chart"/);
    expect(svg).toContain('data-theme="light"');
    expect(svg).toContain("</svg>");
  });

  it("marks the dark render as dark", () => {
    const svg = staticSvg(fixtureBar.spec, { ...SIZE, idPrefix: "d-fixtures-bar-d", dark: true });
    expect(svg).toContain('data-theme="dark"');
  });

  it("returns null for a table, which has no static renderer", () => {
    expect(staticSvg(fixtureTable.spec, { ...SIZE, idPrefix: "d-t-l", dark: false })).toBeNull();
  });

  it.each([
    { mark: "bar", shape: "rect", label: "Last & <leader>" },
    { mark: "line", shape: "path[d^='M'][d*='L']", label: "Last & <leader> $20" },
    { mark: "table", shape: "circle", label: "Last & <leader>" },
  ] satisfies { mark: RaceSpec["mark"]; shape: string; label: string }[])(
    "draws the final $mark frame with the final ranking and escaped labels",
    ({ mark, shape, label }) => {
      const svg = readRace({ ...salesRace, mark }, true);
      expect(svg.getAttribute("aria-label")).toBe("Sales (2002)");
      expect(
        svg.ownerDocument.getElementById(svg.getAttribute("aria-describedby") ?? "")?.textContent,
      ).toBe("1. Last & <leader>, $20.");
      expect(svg.querySelectorAll(shape)).toHaveLength(1);
      const labels = [...svg.querySelectorAll("text")].map((el) => el.textContent);
      expect(labels).toContain(label);
      expect(labels).toContain("2002");
      expect(labels.some((text) => text?.includes("Early leader"))).toBe(false);
    },
  );

  it("paints positive-width bars with a different theme palette in dark mode", () => {
    const light = readRace(salesRace);
    const dark = readRace(salesRace, true);
    expect(Number(dark.querySelector("rect")?.getAttribute("width"))).toBeGreaterThan(0);
    expect(dark.getAttribute("fill")).not.toBe(light.getAttribute("fill"));
    expect(dark.querySelector("rect")?.getAttribute("fill")).not.toBe(
      light.querySelector("rect")?.getAttribute("fill"),
    );
  });

  it("positions a final overtake by rank in the static table", () => {
    const svg = readRace({
      ...salesRace,
      mark: { type: "table", columns: ["rank", "name", "value"] },
      race: { top: 2 },
      data: [
        { year: 2000, name: "Passed", sales: 100 },
        { year: 2000, name: "Winner", sales: 99 },
        { year: 2001, name: "Passed", sales: 99 },
        { year: 2001, name: "Winner", sales: 99.01 },
      ],
    });
    const labels = [...svg.querySelectorAll("text")];
    const y = (label: string) =>
      Number(labels.find((el) => el.textContent === label)?.getAttribute("y"));
    expect(y("Winner")).toBeLessThan(y("Passed"));
    expect(y("1")).toBe(y("Winner"));
    expect(y("2")).toBe(y("Passed"));
  });

  it("sets the baseline inside the top chrome and marks capped titles with an ellipsis", () => {
    const svg = readRace({
      ...salesRace,
      theme: { spacing: { padding: 0 } },
      chrome: { title: { text: "First line\nHidden line", style: { maxLines: 1, fontSize: 20 } } },
    });
    const title = [...svg.querySelectorAll("text")].find((item) =>
      item.textContent?.startsWith("First line"),
    );
    expect(title?.textContent).toBe("First line…");
    expect(Number(title?.getAttribute("y"))).toBeCloseTo(16);
  });

  it("uses the line's color and leader position for the corresponding label", () => {
    const svg = readRace({ ...salesRace, mark: "line" });
    const trace = svg.querySelector("path");
    const name = [...svg.querySelectorAll("tspan")].find(
      (el) => el.textContent === "Last & <leader>",
    );
    expect(name?.getAttribute("fill")).toBe(trace?.getAttribute("stroke"));
    expect(name?.parentElement?.getAttribute("dominant-baseline")).toBe("central");
  });

  it("keeps the author's description along with the final ranking", () => {
    const svg = readRace({ ...salesRace, a11y: { description: "Sales are inflation-adjusted." } });
    expect(svg.querySelector("desc")?.textContent).toBe(
      "Sales are inflation-adjusted. 1. Last & <leader>, $20.",
    );
  });

  it("gives light and dark renders of one spec, and renders of two figures, no shared element id", () => {
    const light = elementIds(
      staticSvg(fixtureBar.spec, { ...SIZE, idPrefix: "d-a-l", dark: false }),
    );
    const dark = elementIds(staticSvg(fixtureBar.spec, { ...SIZE, idPrefix: "d-a-d", dark: true }));
    const other = elementIds(
      staticSvg(fixtureBar.spec, { ...SIZE, idPrefix: "d-b-l", dark: false }),
    );
    expect(light.length).toBeGreaterThan(0);
    const all = [...light, ...dark, ...other];
    expect(new Set(all).size).toBe(all.length);
  });
});
