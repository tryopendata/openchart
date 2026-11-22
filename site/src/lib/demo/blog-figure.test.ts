// @vitest-environment node
/** The blog-only figure options: which docs page a figure credits, and which pages are posts. */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import {
  unemploymentChoropleth,
  unemploymentTilemap,
} from "../../demos/blog/choropleth-vs-tile-map";
import { directLabelsEndpoints } from "../../demos/blog/direct-labels-vs-legends";
import { nycTempRange } from "../../demos/blog/how-to-chart-a-range-of-values";
import { gistempColumns } from "../../demos/blog/how-to-chart-a-temperature-anomaly";
import { energySankeyFull } from "../../demos/blog/how-to-read-and-build-a-sankey-diagram";
import { prestonLogScale } from "../../demos/blog/when-to-use-a-log-scale";
import {
  economiesRankedBar,
  economiesTable,
} from "../../demos/blog/when-to-use-a-table-instead-of-a-chart";
import {
  BLOG_FIGURE_WIDTH,
  blogFigure,
  figureCredit,
  isBlogPostFile,
  isBlogPostPath,
  UnknownFigureCreditError,
} from "./blog-figure";

describe("figureCredit", () => {
  it.each([
    [directLabelsEndpoints, "/docs/change-over-time/line/", "line chart"],
    [gistempColumns, "/docs/comparison/column/", "column chart"],
    [economiesRankedBar, "/docs/comparison/bar/", "bar chart"],
    [prestonLogScale, "/docs/correlation/scatter/", "scatter plot"],
    [nycTempRange, "/docs/comparison/range/", "range chart"],
    [energySankeyFull, "/docs/flow/sankey/", "sankey diagram"],
    [unemploymentTilemap, "/docs/maps/tile-map/", "tile map"],
    [unemploymentChoropleth, "/docs/maps/choropleth/", "choropleth map"],
    [economiesTable, "/docs/tables/data-table/", "data table"],
  ])("credits $id with its chart type's docs page", (demo, href, chartName) => {
    expect(figureCredit(demo.id, demo.spec)).toEqual({ href, chartName });
  });

  it("credits a layer spec by its first layer", () => {
    const layered = {
      layer: [directLabelsEndpoints.spec, prestonLogScale.spec],
    } as unknown as VizSpec;
    expect(figureCredit("blog/layered", layered).href).toBe("/docs/change-over-time/line/");
  });

  it("throws UnknownFigureCreditError naming the demo when a spec has no target", () => {
    const waffle = { mark: "waffle", data: [], encoding: {} } as unknown as VizSpec;
    expect(() => figureCredit("blog/odd-one", waffle)).toThrow(UnknownFigureCreditError);
    expect(() => figureCredit("blog/odd-one", waffle)).toThrow(/blog\/odd-one/);
  });
});

describe("blogFigure", () => {
  it("pairs the credit with the wide column's static width", () => {
    expect(blogFigure(prestonLogScale.id, prestonLogScale.spec)).toEqual({
      credit: figureCredit(prestonLogScale.id, prestonLogScale.spec),
      staticWidth: BLOG_FIGURE_WIDTH,
    });
  });
});

describe("isBlogPostPath", () => {
  it.each([
    ["/blog/when-to-use-a-log-scale/", true],
    ["/blog/when-to-use-a-log-scale", true],
    ["/blog/", false],
    ["/blog", false],
    ["/blog/tags/climate/", false],
    ["/blog/rss.xml", false],
    ["/docs/change-over-time/line/", false],
    ["/", false],
  ])("%s is a post: %s", (path, expected) => {
    expect(isBlogPostPath(path)).toBe(expected);
  });
});

describe("isBlogPostFile", () => {
  it.each([
    [new URL("file:///repo/site/src/content/blog/when-to-use-a-log-scale.mdx"), true],
    ["file:///repo/site/src/content/blog/how-to-chart-a-temperature-anomaly.md", true],
    ["/repo/site/src/content/blog/when-to-use-a-log-scale.mdx", true],
    [new URL("file:///repo/site/src/content/docs/comparison/bar.mdx"), false],
    ["file:///repo/docs/guides/blog/notes.md", false],
    ["file:///repo/site/src/content/blog-drafts/idea.mdx", false],
    ["file:///repo/site/src/content/docs/blog/x.mdx", false],
    [undefined, false],
  ])("%s is a post file: %s", (file, expected) => {
    expect(isBlogPostFile(file)).toBe(expected);
  });
});
