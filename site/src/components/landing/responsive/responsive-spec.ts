/**
 * The chart inside the resize frame: US inflation 2019 to 2024 with the
 * above-4% years shaded, two callouts and the Fed's target as a reference line.
 * Two callouts give the compact layout something to do: under 400px the
 * library keeps one inline callout (the peak, by priority) and drops the other.
 * One spec serves every width.
 */
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../../../demos/source";

export const responsiveSource = sourceOf(usInflation);

export const responsiveSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2 },
  data: usInflation.data.map((row) => ({ ...row })),
  encoding: {
    x: { field: "date", type: "temporal" },
    y: {
      field: "rate",
      type: "quantitative",
      axis: { title: "Year-over-year change (%)", format: ".0f", grid: true },
    },
  },
  annotations: [
    // Unlabelled: a range label anchors at the band's top, onto the peak callout.
    // The subtitle says what the shading means.
    { id: "surge", type: "range", x1: "2021-04-01", x2: "2023-04-01" },
    {
      id: "peak",
      type: "text",
      x: "2022-07-01",
      y: 8.5,
      text: "Peak: **8.5%** in mid-2022",
      anchor: "left",
      offset: { dx: -16, dy: 0 },
      connector: true,
      priority: 1,
    },
    {
      id: "low",
      type: "text",
      x: "2020-04-01",
      y: 0.3,
      text: "Low: **0.3%** in spring 2020",
      anchor: "right",
      offset: { dx: 16, dy: 0 },
      connector: true,
      priority: 2,
    },
    { id: "target", type: "refline", y: 2, label: "Fed 2% target", style: "dashed" },
  ],
  chrome: {
    title: "Inflation ran above 4% for two years before it eased",
    subtitle: "US consumer prices, change from a year earlier, quarterly; shaded above 4%",
  },
};
