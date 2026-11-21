// @vitest-environment node
// A post's lead chart: a chart demo becomes a tile at the blog's size; a table,
// sankey or graph lead fails the build naming the post, since the blog index
// has no styles for those tiles yet.
import { isGraphSpec, isSankeySpec, isTableSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { allDemos } from "../../demos/registry";
import { leadTileHtml } from "./lead-tile";

const demos = allDemos();
const firstOf = (test: (spec: never) => boolean) =>
  demos.find((demo) => test(demo.spec as never))?.id ?? "";

describe("leadTileHtml", () => {
  it("lays a chart demo out as a 360 by 240 tile", () => {
    const html = leadTileHtml("a-post", "blog/gistemp-columns", new Set());
    expect(html).toContain('viewBox="0 0 360 240"');
  });

  it.each([
    ["a table", firstOf(isTableSpec)],
    ["a sankey", firstOf(isSankeySpec)],
    ["a graph", firstOf(isGraphSpec)],
  ])("throws naming the post when the lead is %s (%s)", (kind, id) => {
    expect(id).not.toBe("");
    expect(() => leadTileHtml("a-post", id, new Set())).toThrow(
      `src/content/blog/a-post: lead "${id}": is ${kind}`,
    );
  });

  it("throws naming the post when the lead names no demo", () => {
    expect(() => leadTileHtml("a-post", "blog/nothing", new Set())).toThrow(
      'src/content/blog/a-post: lead "blog/nothing": No demo has the id',
    );
  });
});
