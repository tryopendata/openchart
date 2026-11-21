/**
 * The gallery's composite graphics: the US generation mix split into one panel
 * per source (`electricity-mix-matrix`), and quarterly US inflation layered
 * over a 2% reference rule (`us-inflation`). Ported from the Ladle data and
 * encoding, and building blocks galleries, rebuilt on these tier-1 datasets.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usInflation } from "@datasets/us-inflation";
import { sourceOf } from "../source";
import { ACCENT, INFLATION_SUBTITLE } from "../the-spec/shared";
import { defineDemo } from "../types";
import { MIX_MEASURE, mixRows } from "./shared";

export const electricityFacets = defineDemo({
  id: "gallery/electricity-facets",
  title: "US generation mix, one panel per source, 2016 to 2023",
  source: sourceOf(electricityMixMatrix),
  height: 520,
  spec: {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2 },
    data: mixRows,
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y", tickCount: 3 } },
      y: {
        field: "share",
        type: "quantitative",
        axis: { title: "Share of generation (%)", format: ".0f", grid: true },
      },
      facet: { field: "source", type: "nominal", columns: 3 },
    },
    chrome: {
      title: "Of six sources, only gas, wind and solar gained share from 2016 to 2023",
      subtitle: `${MIX_MEASURE}, one panel per source on a shared scale (%)`,
    },
  },
});

/** The reference level drawn as the second layer, in percent. */
export const INFLATION_REFERENCE = 2;
// Both layers share one y-scale only when each pins the same domain.
const INFLATION_DOMAIN: [number, number] = [0, 9];

export const inflationReference = defineDemo({
  id: "gallery/inflation-reference",
  title: "US inflation against a 2% line, 2019 to 2024",
  source: sourceOf(usInflation),
  height: 420,
  spec: {
    chrome: {
      title: `US inflation was above ${INFLATION_REFERENCE}% in every quarter from mid-2021 through 2024`,
      subtitle: `${INFLATION_SUBTITLE}, with a ${INFLATION_REFERENCE}% line drawn as a second layer`,
    },
    layer: [
      {
        mark: { type: "line", stroke: ACCENT, strokeWidth: 2 },
        data: [...usInflation.data],
        encoding: {
          x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
          y: {
            field: "rate",
            type: "quantitative",
            scale: { domain: INFLATION_DOMAIN },
            axis: { title: "CPI (year-over-year %)", format: ".0f", grid: true },
          },
        },
      },
      {
        // The rule takes its color from the color scale, so a one-entry range sets it.
        mark: { type: "rule" },
        data: [{ level: INFLATION_REFERENCE, label: `${INFLATION_REFERENCE}% line` }],
        encoding: {
          y: { field: "level", type: "quantitative", scale: { domain: INFLATION_DOMAIN } },
          color: { field: "label", type: "nominal", scale: { range: ["#64748b"] } },
        },
      },
    ],
  },
});
