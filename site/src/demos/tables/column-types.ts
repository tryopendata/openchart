/**
 * Demos for the column types page (docs/tables/column-types): one visual
 * feature per column, taken from the Ladle tables gallery. Row counts stay
 * small so each table fits its stage.
 */
import { companyBrands } from "@datasets/company-brands";
import { electionMargins } from "@datasets/election-margins";
import { stockPerformance } from "@datasets/stock-performance";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const heatmapColumn = defineDemo({
  id: "tables/heatmap-column",
  title: "Margin of victory as a heatmap column",
  source: sourceOf(electionMargins),
  height: 600,
  spec: {
    type: "table",
    data: [...electionMargins.data].slice(0, 8),
    columns: [
      { key: "state", label: "State", sortable: true },
      {
        key: "margin",
        label: "Margin (%)",
        format: ".1f",
        sortable: true,
        align: "right",
        heatmap: { palette: "orange" },
      },
      { key: "electoralVotes", label: "Electoral votes", sortable: true, align: "right" },
    ],
    chrome: {
      title: "Republicans won the four closest battleground states",
      subtitle: "Battleground states by margin of victory",
    },
  },
});

export const barColumn = defineDemo({
  id: "tables/bar-column",
  title: "Revenue as an inline bar column",
  source: sourceOf(companyBrands),
  height: 420,
  spec: {
    type: "table",
    data: [...companyBrands.data],
    columns: [
      { key: "company", label: "Company", sortable: true },
      {
        key: "revenue",
        label: "FY24 revenue ($B)",
        format: ",.0f",
        sortable: true,
        align: "right",
        bar: { color: "#0e7490" },
      },
    ],
    chrome: {
      title: "Amazon still tops big tech by revenue",
      subtitle: "Full-year 2024 revenue, with an inline bar scaled to the largest value",
    },
  },
});

export const sparklineColumns = defineDemo({
  id: "tables/sparkline-columns",
  title: "Line and column sparklines in one table",
  source: sourceOf(stockPerformance),
  height: 600,
  spec: {
    type: "table",
    data: [...stockPerformance.data].slice(0, 8),
    columns: [
      { key: "ticker", label: "Ticker", sortable: true },
      { key: "price", label: "Price", format: "$,.2f", sortable: true, align: "right" },
      { key: "trend", label: "8-week trend", sparkline: { type: "line", domain: "row" } },
      { key: "flows", label: "Fund flows", sparkline: { type: "column" } },
    ],
    chrome: {
      title: "Two ways to draw a series in a cell",
      subtitle: "The same sparkline column config with type line and column",
    },
  },
});

export const deltaColumn = defineDemo({
  id: "tables/delta-column",
  title: "Year-to-date change as delta chips",
  source: sourceOf(stockPerformance),
  height: 600,
  spec: {
    type: "table",
    data: [...stockPerformance.data].slice(0, 8),
    columns: [
      { key: "ticker", label: "Ticker" },
      { key: "name", label: "Company" },
      { key: "price", label: "Price", format: "$,.2f" },
      { key: "ytdChange", label: "YTD", format: ".1f", delta: true },
      { key: "trend", label: "8-week trend", sparkline: { type: "line", domain: "row" } },
    ],
    striped: true,
    chrome: {
      title: "All eight stocks are up for the year",
      subtitle:
        "A delta column renders as a signed chip: direction in the arrow, valence in the color",
    },
  },
});

export const imageColumn = defineDemo({
  id: "tables/image-column",
  title: "Logos in an image column",
  source: sourceOf(companyBrands),
  height: 440,
  spec: {
    type: "table",
    data: [...companyBrands.data],
    columns: [
      { key: "logo", label: "", image: { width: 28, height: 28, rounded: true } },
      { key: "company", label: "Company", sortable: true },
      {
        key: "revenue",
        label: "FY24 revenue ($B)",
        format: ",.0f",
        sortable: true,
        align: "right",
        bar: {},
      },
      { key: "quarterly", label: "By quarter", sparkline: { type: "column" } },
    ],
    chrome: {
      title: "Any URL becomes a logo cell",
      subtitle: "Image cells render the column value as an img; here, inline SVG monograms",
    },
  },
});

export const categoryColumn = defineDemo({
  id: "tables/category-column",
  title: "Sectors as category color chips",
  source: sourceOf(stockPerformance),
  height: 600,
  spec: {
    type: "table",
    data: [...stockPerformance.data].slice(0, 8),
    columns: [
      { key: "ticker", label: "Ticker", sortable: true },
      { key: "name", label: "Company", sortable: true },
      {
        key: "sector",
        label: "Sector",
        sortable: true,
        categoryColors: {
          Technology: "#0e7490",
          Communication: "#7c3aed",
          Consumer: "#c2410c",
          Financials: "#15803d",
          Healthcare: "#be123c",
        },
      },
      { key: "ytdChange", label: "YTD %", format: "+.1f", sortable: true, align: "right" },
    ],
    chrome: {
      title: "Category colors turn a column into a legend",
      subtitle: "Each sector value maps to a fixed color chip",
    },
  },
});
