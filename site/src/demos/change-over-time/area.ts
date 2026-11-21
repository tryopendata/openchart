/**
 * Demos for the area chart page (docs/change-over-time/area). Specs follow the
 * Ladle line and area gallery; the overlap demo follows the `stack: null` rule
 * in docs/chart-types.md.
 */
import { bigTechRevenue } from "@datasets/big-tech-revenue";
import { evFleet } from "@datasets/ev-fleet";
import { nvidiaStock } from "@datasets/nvidia-stock";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";

export const basicArea = defineDemo({
  id: "change-over-time/area-basic",
  title: "Cumulative electric car fleet",
  source: sourceOf(evFleet),
  height: 440,
  spec: {
    mark: { type: "area", stroke: ACCENT, strokeWidth: 2 },
    data: [...evFleet.data],
    encoding: {
      x: { field: "year", type: "temporal", axis: { tickCount: 5 } },
      y: {
        field: "fleet",
        type: "quantitative",
        axis: { title: "Cumulative EV fleet (millions)", format: ",.0f", grid: true },
      },
    },
    annotations: [
      {
        type: "text",
        x: "2020-01-01",
        y: 10.5,
        text: "10M milestone",
        anchor: "top",
        offset: { dx: 0, dy: -22 },
        connector: true,
      },
    ],
    chrome: {
      title: "The world's electric car fleet reached 58 million in 2024",
      subtitle: "Cumulative global electric car fleet, 2015-2024 (BEV + PHEV)",
    },
  },
});

export const referenceArea = defineDemo({
  id: "change-over-time/area-reference",
  title: "Nvidia monthly closing price",
  source: sourceOf(nvidiaStock),
  height: 420,
  spec: {
    mark: { type: "area", stroke: ACCENT, strokeWidth: 2 },
    data: [...nvidiaStock.data],
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "price",
        type: "quantitative",
        axis: { title: "Closing price ($)", format: ",.0f", grid: true },
      },
    },
    annotations: [
      {
        type: "refline",
        y: 100,
        label: "$100",
        style: "dashed",
        stroke: "#64748b",
        strokeWidth: 1,
      },
    ],
    chrome: {
      title: "Nvidia's price crossed $100 in 2024",
      subtitle: "Split-adjusted monthly close, January 2023 to December 2025",
    },
  },
});

const OVERLAP_COMPANIES = ["Amazon", "Alphabet", "Meta"];

export const overlappingArea = defineDemo({
  id: "change-over-time/area-overlap",
  title: "Revenue of three companies, overlapping",
  source: sourceOf(bigTechRevenue),
  height: 460,
  spec: {
    mark: "area",
    data: bigTechRevenue.data.filter((row) => OVERLAP_COMPANIES.includes(row.company)),
    encoding: {
      x: { field: "year", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "revenue",
        type: "quantitative",
        stack: null,
        axis: { title: "Annual revenue ($B)", format: ",.0f", grid: true },
      },
      color: { field: "company", type: "nominal" },
    },
    chrome: {
      title: "Each company's revenue is drawn from the same zero line",
      subtitle: "Annual revenue by company, 2019-2024 (billions USD)",
    },
  },
});
