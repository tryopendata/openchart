/**
 * Demos for the stacked area page (docs/change-over-time/stacked-area). The
 * first follows the Ladle line and area gallery; `stack: "normalize"` and
 * `stack: "center"` are the values listed in docs/chart-types.md.
 */
import { energyMix } from "@datasets/energy-mix";
import { defineDemo } from "../types";
import { sourceOf } from "./source";

export const stackedArea = defineDemo({
  id: "change-over-time/stacked-area-basic",
  title: "Global primary energy mix",
  source: sourceOf(energyMix),
  height: 460,
  spec: {
    mark: "area",
    data: [...energyMix.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "energy",
        type: "quantitative",
        stack: "zero",
        axis: { title: "Share of primary energy (%)", format: ".0f", grid: true },
      },
      color: { field: "source", type: "nominal" },
    },
    legend: { position: "top" },
    chrome: {
      title: "Renewables are rising, but fossil fuels still dominate",
      subtitle: "Global primary energy mix by source, 2015-2022 (% of total)",
    },
  },
});

export const normalizedArea = defineDemo({
  id: "change-over-time/stacked-area-normalize",
  title: "Global primary energy mix, normalized",
  source: sourceOf(energyMix),
  height: 460,
  spec: {
    mark: "area",
    data: [...energyMix.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "energy",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of primary energy", format: ".0%", grid: true },
      },
      color: { field: "source", type: "nominal" },
    },
    legend: { position: "top" },
    chrome: {
      title: "Normalizing stretches every year to the same height",
      subtitle: "Global primary energy mix by source, 2015-2022 (share of total)",
    },
  },
});

export const streamgraph = defineDemo({
  id: "change-over-time/stacked-area-center",
  title: "Global primary energy mix as a streamgraph",
  source: sourceOf(energyMix),
  height: 460,
  spec: {
    mark: "area",
    data: [...energyMix.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "energy",
        type: "quantitative",
        stack: "center",
        axis: { title: "Share of primary energy (%)", format: ".0f" },
      },
      color: { field: "source", type: "nominal" },
    },
    legend: { position: "top" },
    chrome: {
      title: "A streamgraph centers the stack around zero",
      subtitle: "Global primary energy mix by source, 2015-2022 (% of total)",
    },
  },
});
