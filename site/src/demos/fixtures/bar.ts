/**
 * A small horizontal bar chart the demo system's tests and the `/fixtures/demo/`
 * page render. It has a static SVG, so it exercises the static-to-live swap.
 * The compact copy lays the same chart out at 360px for `/fixtures/controls/`.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { defineDemo } from "../types";

/** Six illustrative rows: one more than the snippet generator inlines, so its code hoists `data`. */
const fixtureBarSpec: ChartSpec = {
  mark: "bar",
  data: [
    { region: "North", orders: 42 },
    { region: "South", orders: 31 },
    { region: "East", orders: 27 },
    { region: "West", orders: 38 },
    { region: "Central", orders: 19 },
    { region: "Coast", orders: 24 },
  ],
  encoding: {
    y: { field: "region", type: "nominal" },
    x: { field: "orders", type: "quantitative" },
  },
};

export const fixtureBar = defineDemo({
  id: "fixtures/bar",
  title: "Fixture bar chart",
  caption: "Weekly orders by region",
  source: { label: "Illustrative data" },
  height: 320,
  spec: fixtureBarSpec,
});

/** The bar fixture laid out compact, with an explicit renderer so its spec script carries host options. */
export const fixtureCompact = defineDemo({
  id: "fixtures/compact",
  title: "Fixture bar chart, compact",
  caption: "Weekly orders by region at 360px",
  source: { label: "Illustrative data" },
  height: 320,
  width: 360,
  mount: { renderer: "svg" },
  spec: fixtureBarSpec,
});
