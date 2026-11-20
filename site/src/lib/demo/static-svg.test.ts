// @vitest-environment node
/** Build-time static rendering, run with no DOM as the Astro build runs it. */
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
import { staticSvg } from "./static-svg";

const SIZE = { width: 720, height: 320 };

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
