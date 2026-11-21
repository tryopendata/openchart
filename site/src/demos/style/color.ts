/**
 * Demos for the color page (docs/style/color): a categorical palette on the US
 * electricity mix, a sequential scale on the same data as a heatmap, a
 * diverging scale on the global temperature anomaly, and one series
 * highlighted with the rest in grey.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { temperatureAnomaly } from "@datasets/temperature-anomaly";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { TEMPERATURE_ANOMALY_SUBTITLE } from "./temperature";

const MIX_SUBTITLE = "Share of US electricity from the six main sources, %, 2016–2023";

export const categoricalColor = defineDemo({
  id: "style/color-categorical",
  title: "US electricity mix by source, stacked",
  source: sourceOf(electricityMixMatrix),
  height: 460,
  spec: {
    mark: "bar",
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "share",
        type: "quantitative",
        // Workaround: default stacking on an ordinal-x bar leaves the y domain at the largest segment.
        stack: "zero",
        axis: { title: "Share of generation (%)", format: ".0f", grid: true },
      },
      color: {
        field: "source",
        type: "nominal",
        title: "Source",
        sort: ["Coal", "Gas", "Nuclear", "Hydro", "Wind", "Solar"],
      },
    },
    labels: { density: "none" },
    chrome: {
      title:
        "Coal's share of US electricity fell by almost half from 2016 to 2023 as gas, wind and solar grew",
      subtitle: MIX_SUBTITLE,
    },
  },
});

export const sequentialColor = defineDemo({
  id: "style/color-sequential",
  title: "US electricity mix as a heatmap",
  source: sourceOf(electricityMixMatrix),
  caption: "Darker cells are larger shares.",
  height: 400,
  spec: {
    mark: "rect",
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "source",
        type: "nominal",
        sort: ["Gas", "Coal", "Nuclear", "Wind", "Hydro", "Solar"],
      },
      color: {
        field: "share",
        type: "quantitative",
        title: "Share (%)",
        scale: { scheme: "blues" },
        format: ".1f",
      },
    },
    chrome: {
      title: "Gas has been the largest source of US electricity every year since 2016",
      subtitle: MIX_SUBTITLE,
    },
  },
});

export const divergingColor = defineDemo({
  id: "style/color-diverging",
  title: "Global temperature anomaly on a diverging scale",
  source: sourceOf(temperatureAnomaly),
  height: 440,
  spec: {
    mark: "bar",
    data: [...temperatureAnomaly.data],
    encoding: {
      x: { field: "year", type: "ordinal", axis: { title: "Decade" } },
      y: {
        field: "anomaly",
        type: "quantitative",
        axis: { title: "Difference from the 20th-century average (°C)", format: "+.1f" },
      },
      color: {
        field: "anomaly",
        type: "quantitative",
        title: "Anomaly (°C)",
        // redBlue runs red to blue from low to high; reversed, warm is red. The
        // symmetric domain puts zero, the neutral midpoint, at the 20th-century average.
        scale: { scheme: "redBlue", reverse: true, domain: [-1.2, 1.2] },
        format: "+.2f",
      },
    },
    labels: { density: "none" },
    annotations: [{ type: "refline", y: 0, style: "solid", strokeWidth: 1 }],
    chrome: {
      title:
        "Five of six readings before 1960 were below the 20th-century average; all eight since were above",
      subtitle: TEMPERATURE_ANOMALY_SUBTITLE,
    },
  },
});

/**
 * Solar's share in one year of the matrix, for the title.
 *
 * @throws {Error} When the dataset has no solar row for the year.
 */
function solarShare(year: string): number {
  const row = electricityMixMatrix.data.find((r) => r.source === "Solar" && r.year === year);
  if (row?.share === undefined) {
    throw new Error(`electricity-mix-matrix has no Solar share for ${year}.`);
  }
  return row.share;
}

export const highlightColor = defineDemo({
  id: "style/color-highlight",
  title: "US electricity mix with solar highlighted",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: { type: "line", strokeWidth: 2.5 },
    data: [...electricityMixMatrix.data],
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y", tickCount: 8 } },
      y: {
        field: "share",
        type: "quantitative",
        axis: { title: "Share of generation (%)", format: ".0f", grid: true },
      },
      color: { field: "source", type: "nominal", highlight: "Solar" },
    },
    endpointLabels: { content: "label" },
    chrome: {
      title: `Solar's share of US electricity rose from ${solarShare("2016")}% in 2016 to ${solarShare("2023")}% in 2023`,
      subtitle: MIX_SUBTITLE,
    },
  },
});
