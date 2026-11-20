/**
 * Demos for the stacked area page (docs/change-over-time/stacked-area). The
 * first follows the Ladle line and area gallery; `stack: "normalize"` and
 * `stack: "center"` are the values listed in docs/chart-types.md.
 */
import { energyMix } from "@datasets/energy-mix";
import { renewableCapacityAdditions } from "@datasets/renewable-capacity";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

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
  title: "Renewable capacity added, normalized",
  source: sourceOf(renewableCapacityAdditions),
  height: 460,
  spec: {
    mark: "area",
    data: [...renewableCapacityAdditions.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "capacity",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of capacity added", format: ".0%", grid: true },
      },
      color: { field: "type", type: "nominal" },
    },
    legend: { position: "top" },
    chrome: {
      title: "Normalizing turns growing totals into shares",
      subtitle: "Global renewable capacity additions by source, 2019-2023 (share of gigawatts)",
    },
  },
});

export const streamgraph = defineDemo({
  id: "change-over-time/stacked-area-center",
  title: "Renewable capacity added as a streamgraph",
  source: sourceOf(renewableCapacityAdditions),
  height: 460,
  spec: {
    mark: "area",
    data: [...renewableCapacityAdditions.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "capacity",
        type: "quantitative",
        stack: "center",
        axis: { title: "Capacity added (GW)", format: ".0f" },
      },
      color: { field: "type", type: "nominal" },
    },
    legend: { position: "top" },
    chrome: {
      title: "A streamgraph centers a growing total around zero",
      subtitle: "Global renewable capacity additions by source, 2019-2023 (gigawatts)",
    },
  },
});
