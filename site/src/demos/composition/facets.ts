/**
 * Demos for the facets page (docs/composition/facets). Specs follow the Ladle
 * data and encoding gallery: one chart split into panels by a facet, row or
 * column channel, with scales shared unless `resolve` says otherwise.
 */
import { gdpGrowthByCountry } from "@datasets/gdp-growth-by-country";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const gdpEncoding = {
  x: { field: "date", type: "temporal", axis: { format: "%Y" } },
  y: { field: "gdp", type: "quantitative", axis: { format: ".0f" } },
} as const;

export const sharedFacets = defineDemo({
  id: "composition/facet-shared",
  title: "GDP growth in a wrapped grid, shared scale",
  source: sourceOf(gdpGrowthByCountry),
  height: 460,
  spec: {
    mark: "line",
    data: [...gdpGrowthByCountry.data],
    encoding: {
      ...gdpEncoding,
      facet: { field: "country", type: "nominal", columns: 3 },
    },
    chrome: {
      title: "One panel per economy, one shared scale",
      subtitle:
        "Annual real GDP growth split into a small-multiples grid by country (shared y-axis)",
    },
  },
});

export const independentFacets = defineDemo({
  id: "composition/facet-independent",
  title: "GDP growth with independent y-scales",
  source: sourceOf(gdpGrowthByCountry),
  height: 460,
  spec: {
    mark: "line",
    data: [...gdpGrowthByCountry.data],
    encoding: {
      ...gdpEncoding,
      facet: { field: "country", type: "nominal", columns: 3 },
    },
    resolve: { scale: { y: "independent" } },
    chrome: {
      title: "Independent scales read the shape, not the level",
      subtitle: "Each panel gets its own y-domain, so each economy fills its frame",
    },
  },
});

export const columnFacets = defineDemo({
  id: "composition/facet-column",
  title: "GDP growth in side-by-side panels",
  source: sourceOf(gdpGrowthByCountry),
  height: 400,
  spec: {
    mark: "line",
    data: [...gdpGrowthByCountry.data],
    encoding: {
      ...gdpEncoding,
      column: { field: "country", type: "nominal" },
    },
    chrome: {
      title: "The same three economies in one row",
      subtitle: "Annual real GDP growth, one column per country",
    },
  },
});

export const rowFacets = defineDemo({
  id: "composition/facet-row",
  title: "Exemption rates in stacked panels",
  source: { label: "Illustrative data" },
  height: 500,
  spec: {
    mark: { type: "bar", orient: "horizontal" },
    data: [
      { period: "2011-12", state: "Oregon", rate: 6.4, party: "Blue" },
      { period: "2011-12", state: "Washington", rate: 5.2, party: "Blue" },
      { period: "2011-12", state: "Vermont", rate: 4.8, party: "Blue" },
      { period: "2011-12", state: "Colorado", rate: 4.1, party: "Blue" },
      { period: "2024-25", state: "Idaho", rate: 8.1, party: "Red" },
      { period: "2024-25", state: "Wyoming", rate: 7.3, party: "Red" },
      { period: "2024-25", state: "Alaska", rate: 6.9, party: "Red" },
      { period: "2024-25", state: "Utah", rate: 5.8, party: "Red" },
    ],
    encoding: {
      x: { field: "rate", type: "quantitative", axis: { title: "Exemption rate (%)" } },
      y: { field: "state", type: "nominal", sort: null },
      color: { field: "party", type: "nominal", scale: { range: ["#4373b8", "#d1495b"] } },
      row: { field: "period", type: "ordinal", sort: null },
    },
    chrome: {
      title: "Top exemption states flipped parties",
      subtitle: "Row faceting stacks panels vertically with a shared x-axis",
    },
  },
});
