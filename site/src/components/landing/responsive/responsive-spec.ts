/**
 * The chart inside the resize frame: US inflation 2019 to 2024 with a range,
 * a peak callout and the Fed's target as a reference line, so the compact
 * layout has something visible to do: the axis drops to every other year and
 * the title wraps. One spec serves every width.
 */
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec } from "@opendata-ai/openchart-core";

export const responsiveSource = {
  label: usInflation.source.replace(/^Source:\s*/, ""),
  url: usInflation.url,
};

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
    {
      id: "surge",
      type: "range",
      x1: "2021-04-01",
      x2: "2023-04-01",
      label: "Above 4%",
      labelAnchor: "bottom",
    },
    {
      id: "peak",
      type: "text",
      x: "2022-07-01",
      y: 8.5,
      text: "Peak: **8.5%** in mid-2022",
      // Left of the peak, so the callout stays inside a 280px frame.
      anchor: "left",
      offset: { dx: -16, dy: 0 },
      connector: true,
    },
    { id: "target", type: "refline", y: 2, label: "Fed 2% target", style: "dashed" },
  ],
  chrome: {
    title: "Inflation ran above 4% for two years before it eased",
    subtitle: "US consumer prices, change from a year earlier, quarterly",
  },
};
