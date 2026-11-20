/**
 * Demos for the heatmap page (docs/correlation/heatmap). The heatmap is the
 * `rect` mark; specs follow the rect heatmap story in the Ladle scatter and
 * distribution gallery.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { defineDemo } from "../types";
import { sourceOf } from "./shared";

const subtitle = "Share of US electricity generation by source (%), 2016-2023";

export const basicHeatmap = defineDemo({
  id: "correlation/heatmap-basic",
  title: "US electricity mix by source and year",
  source: sourceOf(electricityMixMatrix),
  height: 380,
  spec: {
    mark: "rect",
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "nominal" },
      y: { field: "source", type: "nominal" },
      color: {
        field: "share",
        type: "quantitative",
        scale: { scheme: "blues" },
        format: ".1f",
      },
    },
    chrome: {
      title: "Gas rose as coal's share halved",
      subtitle: `${subtitle}. Darker cells = larger share.`,
    },
  },
});

export const schemeHeatmap = defineDemo({
  id: "correlation/heatmap-scheme",
  title: "US electricity mix, orange scheme",
  source: sourceOf(electricityMixMatrix),
  height: 380,
  spec: {
    mark: "rect",
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "nominal" },
      y: { field: "source", type: "nominal" },
      color: {
        field: "share",
        type: "quantitative",
        scale: { scheme: "orange" },
        format: ".1f",
      },
    },
    chrome: {
      title: "The same matrix in another sequential scheme",
      subtitle,
    },
  },
});

export const domainHeatmap = defineDemo({
  id: "correlation/heatmap-domain",
  title: "US electricity mix, fixed color domain",
  source: sourceOf(electricityMixMatrix),
  height: 380,
  spec: {
    mark: "rect",
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "nominal" },
      y: { field: "source", type: "nominal" },
      color: {
        field: "share",
        type: "quantitative",
        scale: { scheme: "blues", domain: [0, 100] },
        format: ".1f",
      },
    },
    chrome: {
      title: "A 0 to 100 domain shows how small the renewables are",
      subtitle,
    },
  },
});

export const orderedHeatmap = defineDemo({
  id: "correlation/heatmap-ordered",
  title: "US electricity mix, rows in a chosen order",
  source: sourceOf(electricityMixMatrix),
  height: 380,
  spec: {
    mark: "rect",
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "nominal" },
      y: {
        field: "source",
        type: "nominal",
        sort: ["Solar", "Wind", "Hydro", "Nuclear", "Coal", "Gas"],
      },
      color: {
        field: "share",
        type: "quantitative",
        scale: { scheme: "blues" },
        format: ".1f",
      },
    },
    chrome: {
      title: "Rows set by hand, with the largest source on top",
      subtitle,
    },
  },
});
