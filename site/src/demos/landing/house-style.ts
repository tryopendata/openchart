/**
 * The chart the landing page's house-style section restyles. It carries the
 * chrome a preset styles (eyebrow, title, subtitle) so each preset's typography
 * and rules show, and it sets no colors of its own, so the presets' palettes do.
 * The source line is the figure's caption on the page. Data: the
 * gdp-growth-by-country dataset module.
 */
import { gdpGrowthByCountry } from "@datasets/gdp-growth-by-country";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const houseStyle = defineDemo({
  id: "landing/house-style",
  title: "GDP growth in three economies, for restyling",
  source: sourceOf(gdpGrowthByCountry),
  height: 440,
  spec: {
    mark: "line",
    data: [...gdpGrowthByCountry.data],
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 4 } },
      y: {
        field: "gdp",
        type: "quantitative",
        axis: { title: "Real GDP growth (%)", format: "+.0f", grid: true },
      },
      color: { field: "country", type: "nominal" },
    },
    annotations: [{ type: "refline", y: 0, style: "solid", strokeWidth: 1 }],
    endpointLabels: { format: "+.1f" },
    chrome: {
      eyebrow: "World economy",
      title: "The euro area stalled while the US kept growing",
      subtitle: "Annual real GDP growth, 2018-2024",
    },
  },
});
