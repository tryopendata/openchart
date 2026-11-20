/**
 * Demos for the sparkline page (docs/change-over-time/sparkline). Specs follow
 * the sparkline recipe in docs/dashboards.md and the Ladle dashboards gallery;
 * the series come from the market-indices dataset module.
 */
import { marketIndices } from "@datasets/market-indices";
import { defineDemo } from "../types";
import { sourceOf } from "./source";

const ACCENT = "#0891b2";

/** One index's series by symbol; the dataset module has six. */
function seriesOf(symbol: string) {
  const index = marketIndices.indices.find((candidate) => candidate.symbol === symbol);
  if (!index) throw new Error(`market-indices has no index with symbol "${symbol}".`);
  return [...index.series];
}

const encoding = {
  x: { field: "t", type: "ordinal" },
  y: { field: "value", type: "quantitative" },
} as const;

export const lineSparkline = defineDemo({
  id: "change-over-time/sparkline-line",
  title: "A line sparkline",
  source: sourceOf(marketIndices),
  height: 56,
  caption: "Russell 2000, 40 intraday-style readings.",
  spec: {
    mark: { type: "line", stroke: ACCENT },
    data: seriesOf("RUT"),
    encoding,
    display: "sparkline",
  },
});

export const areaSparkline = defineDemo({
  id: "change-over-time/sparkline-area",
  title: "An area sparkline",
  source: sourceOf(marketIndices),
  height: 56,
  caption: "S&P 500, 40 intraday-style readings.",
  spec: {
    mark: { type: "area", stroke: ACCENT },
    data: seriesOf("SPX"),
    encoding,
    display: "sparkline",
  },
});

export const lastPointSparkline = defineDemo({
  id: "change-over-time/sparkline-last-point",
  title: "A sparkline with its last point marked",
  source: sourceOf(marketIndices),
  height: 56,
  caption: "Dow Jones, 40 intraday-style readings.",
  spec: {
    mark: { type: "line", stroke: ACCENT, point: "last" },
    data: seriesOf("DJI"),
    encoding,
    display: "sparkline",
  },
});

export const taller = defineDemo({
  id: "change-over-time/sparkline-height",
  title: "The same sparkline in a taller box",
  source: sourceOf(marketIndices),
  height: 120,
  caption: "FTSE 100, 40 intraday-style readings.",
  spec: {
    mark: { type: "area", stroke: ACCENT },
    data: seriesOf("FTSE"),
    encoding,
    display: "sparkline",
  },
});
