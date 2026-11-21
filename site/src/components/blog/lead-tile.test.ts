// @vitest-environment node
// A post's lead chart: any demo becomes a tile at the blog's size, with its
// static chart as image files, or a table or sankey's fallback table; an
// unknown demo fails the build naming the post.
import { isSankeySpec, isTableSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { allDemos } from "../../demos/registry";
import { leadTileHtml, leadTileRequests } from "./lead-tile";

const demos = allDemos();
const firstOf = (test: (spec: never) => boolean) =>
  demos.find((demo) => test(demo.spec as never))?.id ?? "";

describe("leadTileHtml", () => {
  it("lays a chart demo out as a 360 by 240 tile, shown from its files", () => {
    const html = leadTileHtml("a-post", "blog/gistemp-columns", new Set());
    expect(html).toContain('src="/tiles/blog--gistemp-columns-360x240-light.svg"');
    expect(html).toContain('src="/tiles/blog--gistemp-columns-360x240-dark.svg"');
    expect(leadTileRequests(["blog/gistemp-columns"])).toEqual([
      { demo: "blog/gistemp-columns", size: { width: 360, height: 240 }, spec: undefined },
    ]);
  });

  it.each([
    ["a table", firstOf(isTableSpec)],
    ["a sankey", firstOf(isSankeySpec)],
  ])("gives %s lead (%s) its fallback table", (_kind, id) => {
    expect(id).not.toBe("");
    expect(leadTileHtml("a-post", id, new Set())).toContain('<table class="tile-table">');
  });

  it("throws naming the post when the lead names no demo", () => {
    expect(() => leadTileHtml("a-post", "blog/nothing", new Set())).toThrow(
      'src/content/blog/a-post: lead "blog/nothing": Tile "blog/nothing": No demo has the id',
    );
  });
});
