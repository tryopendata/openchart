/**
 * Demos for the dashboard tiles page (docs/composition/dashboard-tiles): the
 * compact forms a spec can express for dense layouts. Each demo's stage height
 * is the tile height. Specs follow the Ladle dashboards gallery and
 * docs/dashboards.md; none of them builds the surrounding layout.
 */
import { marketIndices } from "@datasets/market-indices";
import { nvidiaStock } from "@datasets/nvidia-stock";
import { programmingLanguages } from "@datasets/programming-languages";
import { stockPerformance } from "@datasets/stock-performance";
import { usPayrolls } from "@datasets/us-payrolls";
import { defineDemo } from "../types";
import { sourceOf } from "./source";

const ACCENT = "#0e7490";

const [spx, , russell] = marketIndices.indices;

export const areaSparkline = defineDemo({
  id: "composition/tile-sparkline-area",
  title: "An area sparkline",
  source: sourceOf(marketIndices),
  height: 56,
  spec: {
    mark: "area",
    data: [...spx.series],
    encoding: {
      x: { field: "t", type: "ordinal" },
      y: { field: "value", type: "quantitative" },
    },
    display: "sparkline",
  },
});

export const lineSparkline = defineDemo({
  id: "composition/tile-sparkline-line",
  title: "A line sparkline with an explicit stroke",
  source: sourceOf(marketIndices),
  height: 56,
  spec: {
    mark: { type: "line", stroke: ACCENT },
    data: [...russell.series],
    encoding: {
      x: { field: "t", type: "ordinal" },
      y: { field: "value", type: "quantitative" },
    },
    display: "sparkline",
  },
});

export const compactChart = defineDemo({
  id: "composition/tile-compact-chart",
  title: "A column chart in a 180px tile",
  source: sourceOf(usPayrolls),
  height: 180,
  spec: {
    mark: "bar",
    data: [...usPayrolls.data],
    encoding: {
      x: { field: "month", type: "nominal" },
      y: { field: "jobs", type: "quantitative" },
    },
    watermark: false,
    chrome: { title: "Payroll additions, 2024" },
  },
});

export const metricsTile = defineDemo({
  id: "composition/tile-metrics",
  title: "A chart with a metrics row",
  source: sourceOf(nvidiaStock),
  height: 420,
  spec: {
    mark: { type: "area", stroke: ACCENT, strokeWidth: 2 },
    data: [...nvidiaStock.data],
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 4 } },
      y: {
        field: "price",
        type: "quantitative",
        axis: { title: "Share price", format: "$,.0f" },
        scale: { zero: false },
      },
    },
    metrics: [
      { label: "Close", value: "$186.50" },
      { label: "52-wk high", value: "$202.48" },
      { label: "52-wk low", value: "$108.36" },
      { label: "3-yr return", value: "+855%", delta: "9.6×", deltaTone: "up" },
    ],
    labels: { density: "none" },
    chrome: {
      title: "NVIDIA at a glance",
      subtitle: "NVDA monthly close with headline stats, Jan 2023 to Dec 2025",
    },
  },
});

export const barListTile = defineDemo({
  id: "composition/tile-bar-list",
  title: "A bar list in a card",
  source: sourceOf(programmingLanguages),
  height: 330,
  spec: {
    type: "barlist",
    data: [...programmingLanguages.data].slice(0, 8),
    encoding: {
      label: { field: "language", type: "nominal" },
      value: { field: "pct", type: "quantitative", format: ".1f" },
      color: { field: "category", type: "nominal" },
    },
    barHeight: 8,
    watermark: false,
    chrome: { title: "Top languages", subtitle: "Language popularity index, % share" },
  },
});

export const tableTile = defineDemo({
  id: "composition/tile-table",
  title: "A condensed table in a tile",
  source: sourceOf(stockPerformance),
  height: 420,
  spec: {
    type: "table",
    data: [...stockPerformance.data].slice(0, 5),
    columns: [
      { key: "ticker", label: "Ticker" },
      { key: "price", label: "Price", format: "$,.2f" },
      { key: "ytdChange", label: "YTD", format: ".1f", delta: true },
      { key: "trend", label: "8-week trend", sparkline: { type: "line", domain: "row" } },
    ],
    density: "condensed",
    watermark: false,
    chrome: { title: "Watchlist" },
  },
});
