// @vitest-environment node
// The choropleth vs tile map post embeds the tile map spec in a `json demo`
// fence so readers can copy it. It must stay identical to the registered demo,
// plot the BLS state unemployment values unchanged, and render cleanly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { rowsByFips } from "../maps/state-fips";
import { unemploymentChoropleth, unemploymentTilemap } from "./choropleth-vs-tile-map";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/choropleth-vs-tile-map.mdx"),
  "utf8",
);

describe("the choropleth vs tile map post's figures", () => {
  it("writes the tile map spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${unemploymentTilemap.source.label}"`);
    expect(info).toContain(`height=${unemploymentTilemap.height}`);
    expect(JSON.parse(body)).toEqual(unemploymentTilemap.spec);
  });

  it("plots the dataset's state unemployment values unchanged", () => {
    expect((unemploymentTilemap.spec as { data?: unknown }).data).toEqual(usStateUnemployment.data);
    expect((unemploymentChoropleth.spec as { data?: unknown }).data).toEqual(
      rowsByFips(usStateUnemployment.data, "rate"),
    );
  });

  it("titles each chart with a finding computed from the data", () => {
    const title = (demo: typeof unemploymentChoropleth | typeof unemploymentTilemap) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(unemploymentChoropleth)).toBe(
      "Unemployment ranges from 2.3% in South Dakota to 5.7% in DC",
    );
    expect(title(unemploymentTilemap)).toBe(
      "DC (5.7%) and Delaware (5.4%) lead US state unemployment",
    );
  });

  it("passes spec validation and renders static SVG pairs cleanly", () => {
    for (const demo of [unemploymentChoropleth, unemploymentTilemap]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replace("/", "-"),
        width: 720,
        height: demo.height ?? 460,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs ?? "", demo.id).toContain('data-theme="light"');
      expect(svgs ?? "", demo.id).toContain('data-theme="dark"');
    }
  });
});
