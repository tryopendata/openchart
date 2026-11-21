/**
 * Demos for the data table page (docs/tables/data-table). Specs follow the Ladle
 * tables gallery; tables have no static SVG, so each mounts on the client and
 * its stage height fits the rows.
 */
import { companyBrands } from "@datasets/company-brands";
import { countryIndicators } from "@datasets/country-indicators";
import { stockPerformance } from "@datasets/stock-performance";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const basicTable = defineDemo({
  id: "tables/basic",
  title: "Indicators for twelve economies",
  source: sourceOf(countryIndicators),
  height: 700,
  spec: {
    type: "table",
    data: [...countryIndicators.data],
    columns: [
      { key: "country", label: "Country", sortable: true },
      { key: "population", label: "Population", format: ",.0f", sortable: true, align: "right" },
      {
        key: "gdpPerCapita",
        label: "GDP/capita (PPP)",
        format: "$,.0f",
        sortable: true,
        align: "right",
      },
      { key: "lifeExpectancy", label: "Life exp.", format: ".1f", sortable: true, align: "right" },
    ],
    chrome: {
      title: "Twelve of the world's largest economies",
      subtitle: "Population, income and longevity for the largest economies",
    },
    search: true,
    pagination: { pageSize: 8 },
  },
});

export const sortedTable = defineDemo({
  id: "tables/initial-sort",
  title: "Stocks ranked by year-to-date change",
  source: sourceOf(stockPerformance),
  height: 700,
  spec: {
    type: "table",
    data: [...stockPerformance.data].slice(0, 12),
    columns: [
      { key: "ticker", label: "Ticker", sortable: true },
      { key: "name", label: "Company", sortable: true },
      { key: "sector", label: "Sector", sortable: true },
      { key: "price", label: "Price", format: "$,.2f", sortable: true, align: "right" },
      { key: "ytdChange", label: "YTD %", format: "+.1f", sortable: true, align: "right" },
    ],
    sort: { column: "ytdChange", direction: "desc" },
    density: "condensed",
    chrome: {
      title: "The biggest gainers lead the table",
      subtitle: "Click a header to sort by another column",
    },
  },
});

export const totalsTable = defineDemo({
  id: "tables/totals",
  title: "Big tech revenue with a total row",
  source: sourceOf(companyBrands),
  height: 380,
  spec: {
    type: "table",
    data: [...companyBrands.data],
    columns: [
      { key: "company", label: "Company" },
      { key: "revenue", label: "FY24 revenue ($B)", format: ",.0f", bar: {} },
    ],
    density: "condensed",
    totalRow: true,
    chrome: {
      title: "Big tech, summed",
      subtitle: "Condensed rows with a sticky total over the filtered set",
    },
  },
});

export const relaxedTable = defineDemo({
  id: "tables/relaxed",
  title: "Relaxed rows with compact numbers",
  source: sourceOf(countryIndicators),
  height: 520,
  spec: {
    type: "table",
    data: [...countryIndicators.data].slice(0, 6),
    columns: [
      { key: "country", label: "Country" },
      { key: "population", label: "Population", format: "compact" },
      { key: "gdpPerCapita", label: "GDP/capita (PPP)", format: "$,.0f" },
      { key: "lifeExpectancy", label: "Life exp.", format: ".1f" },
    ],
    density: "relaxed",
    chrome: {
      title: "Six of the world's most populous countries",
      subtitle: "Relaxed density at 56px rows, with the population column formatted compact",
    },
  },
});
