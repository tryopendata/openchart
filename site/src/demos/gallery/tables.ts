/**
 * The gallery's tables: twelve large economies (`country-indicators`), longest
 * life expectancy first, with heatmap and bar cells; and each source's share of
 * US generation in 2016 and 2023 with the change between them
 * (`electricity-mix-matrix`). Ported from the Ladle tables gallery, on these
 * tier-1 datasets.
 */
import { countryIndicators } from "@datasets/country-indicators";
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { sourceOf } from "../source";
import { ACCENT } from "../the-spec/shared";
import { defineDemo } from "../types";
import { MIX_MEASURE, SOURCES, shareOf } from "./shared";

// Sorted in the data as well as by `sort`, so a tile's first rows are the table's first rows.
const byLifeExpectancy = [...countryIndicators.data].sort(
  (a, b) => b.lifeExpectancy - a.lifeExpectancy,
);
const [longest] = byLifeExpectancy;

export const countryTable = defineDemo({
  id: "gallery/country-table",
  title: "Life expectancy, GDP per person and population in 12 large economies",
  source: sourceOf(countryIndicators),
  height: 620,
  spec: {
    type: "table",
    data: byLifeExpectancy,
    columns: [
      { key: "country", label: "Country", sortable: true },
      {
        key: "lifeExpectancy",
        label: "Life expectancy (years)",
        format: ".1f",
        sortable: true,
        align: "right",
        heatmap: { palette: "blue" },
      },
      {
        key: "gdpPerCapita",
        label: "GDP per person (PPP $)",
        format: "$,.0f",
        sortable: true,
        bar: { color: ACCENT },
      },
      {
        key: "population",
        label: "Population",
        format: ",.0f",
        sortable: true,
        align: "right",
      },
    ],
    sort: { column: "lifeExpectancy", direction: "desc" },
    chrome: {
      title: `${longest?.country} has the longest life expectancy of these ${countryIndicators.data.length} countries, at ${longest?.lifeExpectancy} years`,
      subtitle:
        "Life expectancy about 2021 (WHO), GDP per person at purchasing power parity about 2022 (OWID, World Bank) and population in 2023 (World Bank)",
    },
  },
});

/** Each source's share in the first and last year, and the change in points, largest gain first. */
const shareChanges = SOURCES.map((source) => {
  const first = shareOf(source, "2016");
  const last = shareOf(source, "2023");
  return { source, first, last, change: Math.round((last - first) * 10) / 10 };
}).sort((a, b) => b.change - a.change);
const [largestGain] = shareChanges;

export const electricityChangeTable = defineDemo({
  id: "gallery/electricity-change-table",
  title: "Change in each source's share of generation from six sources, 2016 to 2023",
  source: sourceOf(electricityMixMatrix),
  height: 420,
  spec: {
    type: "table",
    data: shareChanges,
    columns: [
      { key: "source", label: "Source" },
      { key: "first", label: "2016 (%)", format: ".1f", align: "right" },
      { key: "last", label: "2023 (%)", format: ".1f", bar: { color: ACCENT } },
      { key: "change", label: "Change (points)", format: "+.1f", align: "right" },
    ],
    chrome: {
      title: `${largestGain?.source} gained the most share of generation from six sources, ${largestGain?.change} points from 2016 to 2023`,
      subtitle: `${MIX_MEASURE}, 2016 and 2023 (%)`,
    },
  },
});
