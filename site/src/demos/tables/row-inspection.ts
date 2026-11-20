/**
 * Demos for the row inspection page (docs/tables/row-inspection). The bar chart
 * option `rowHover` is a mount option, not a spec field, so the first figure
 * shows the chart it applies to without the option. The table figures show the
 * built-in ways to find and compare rows: search, sort, paging and totals.
 */
import { companyBrands } from "@datasets/company-brands";
import { countryIndicators } from "@datasets/country-indicators";
import { stockPerformance } from "@datasets/stock-performance";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const rowBars = defineDemo({
  id: "tables/row-bars",
  title: "A simple horizontal bar chart",
  caption: "Row inspection is a mount option, so this figure shows the spec without it",
  source: { label: "Illustrative data" },
  height: 360,
  spec: {
    mark: "bar",
    data: [
      { name: "North", value: 82 },
      { name: "South", value: 61 },
      { name: "East", value: 49 },
      { name: "West", value: 33 },
    ],
    encoding: {
      y: { field: "name", type: "nominal", sort: null },
      x: { field: "value", type: "quantitative" },
    },
    labels: { placement: "column" },
    chrome: {
      title: "Compare a row",
      subtitle: "Values by region",
    },
  },
});

export const searchTable = defineDemo({
  id: "tables/row-search",
  title: "Finding a row with search",
  source: sourceOf(stockPerformance),
  height: 560,
  spec: {
    type: "table",
    data: [...stockPerformance.data].slice(0, 12),
    columns: [
      { key: "ticker", label: "Ticker", sortable: true },
      { key: "name", label: "Company", sortable: true },
      { key: "sector", label: "Sector", sortable: true },
      { key: "price", label: "Price", format: "$,.2f", sortable: true, align: "right" },
    ],
    search: true,
    pagination: { pageSize: 6 },
    chrome: {
      title: "Type to filter the rows",
      subtitle: "Search matches any column; the pager covers the rest",
    },
  },
});

export const sortedHeatmapTable = defineDemo({
  id: "tables/row-sort-heatmap",
  title: "Sorting to compare extremes",
  source: sourceOf(countryIndicators),
  height: 560,
  spec: {
    type: "table",
    data: [...countryIndicators.data].slice(0, 8),
    columns: [
      { key: "country", label: "Country", sortable: true },
      {
        key: "gdpPerCapita",
        label: "GDP/capita (PPP)",
        format: "$,.0f",
        sortable: true,
        align: "right",
        heatmap: { palette: "green" },
      },
      { key: "lifeExpectancy", label: "Life exp.", format: ".1f", sortable: true, align: "right" },
    ],
    sort: { column: "lifeExpectancy", direction: "asc" },
    chrome: {
      title: "Lowest life expectancy first",
      subtitle: "Click a header to reorder; the heatmap keeps the income gap visible",
    },
  },
});

export const filteredTotalsTable = defineDemo({
  id: "tables/row-filtered-totals",
  title: "A total that follows the search",
  source: sourceOf(companyBrands),
  height: 440,
  spec: {
    type: "table",
    data: [...companyBrands.data],
    columns: [
      { key: "company", label: "Company", sortable: true },
      { key: "revenue", label: "FY24 revenue ($B)", format: ",.0f", sortable: true, bar: {} },
    ],
    search: true,
    totalRow: true,
    density: "condensed",
    chrome: {
      title: "Search, then read the sum",
      subtitle: "The total row covers the rows left after filtering",
    },
  },
});
