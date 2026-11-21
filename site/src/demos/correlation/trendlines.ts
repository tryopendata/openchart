/**
 * Demos for the trendlines page (docs/correlation/trendlines). The trend line is
 * the `trendline` option on the point mark (see TrendlineConfig in the core spec
 * types); the engine fits one least-squares line over every point in the chart.
 */
import { costOfLiving } from "@datasets/cost-of-living";
import { pisaScores } from "@datasets/pisa-scores";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { campusReading, ILLUSTRATIVE } from "./shared";

const spendingAxis = { title: "Spending per student ($K, PPP)" };
const mathAxis = { title: "PISA math score" };

const pisaEncoding = {
  x: { field: "spending", type: "quantitative", axis: spendingAxis },
  y: { field: "math", type: "quantitative", axis: mathAxis },
} as const;

const pisaSubtitle = "Cumulative per-student spending vs. PISA 2022 math performance";

export const defaultTrendline = defineDemo({
  id: "correlation/trendlines-default",
  title: "The default trend line",
  source: sourceOf(pisaScores),
  height: 440,
  spec: {
    mark: "point",
    data: [...pisaScores.data],
    encoding: pisaEncoding,
    chrome: {
      title: "A scatter draws its trend line without being asked",
      subtitle: pisaSubtitle,
    },
  },
});

export const noTrendline = defineDemo({
  id: "correlation/trendlines-off",
  title: "A scatter with the trend line off",
  source: sourceOf(pisaScores),
  height: 440,
  spec: {
    mark: { type: "point", trendline: false },
    data: [...pisaScores.data],
    encoding: pisaEncoding,
    chrome: {
      title: "The same points with no fitted line",
      subtitle: pisaSubtitle,
    },
  },
});

export const styledTrendline = defineDemo({
  id: "correlation/trendlines-styled",
  title: "A styled trend line",
  source: sourceOf(pisaScores),
  height: 440,
  spec: {
    mark: { type: "point", trendline: { stroke: "#d1495b", strokeWidth: 2.5 } },
    data: [...pisaScores.data],
    encoding: pisaEncoding,
    chrome: {
      title: "Stroke color and width set how much the line stands out",
      subtitle: pisaSubtitle,
    },
  },
});

export const aboveTrendline = defineDemo({
  id: "correlation/trendlines-above",
  title: "A trend line over a dense cloud",
  source: ILLUSTRATIVE,
  caption: `A seeded sample of ${campusReading.length} invented campuses.`,
  height: 440,
  spec: {
    mark: {
      type: "point",
      size: 3,
      opacity: 0.45,
      trendline: { layer: "above", strokeWidth: 2.5 },
    },
    data: campusReading,
    encoding: {
      x: {
        field: "lowIncome",
        type: "quantitative",
        scale: { domain: [0, 100] },
        axis: { title: "Students from low-income households (%)" },
      },
      y: {
        field: "reading",
        type: "quantitative",
        scale: { domain: [0, 100] },
        axis: { title: "Reading at grade level (%)" },
      },
    },
    chrome: {
      title: "Reading scores fall as the low-income share rises",
      subtitle: "Share of students reading at grade level vs. low-income share, by campus",
    },
  },
});

export const groupedTrendline = defineDemo({
  id: "correlation/trendlines-grouped",
  title: "One trend line across color groups",
  source: sourceOf(costOfLiving),
  height: 460,
  spec: {
    mark: "point",
    data: [...costOfLiving.data],
    encoding: {
      x: {
        field: "cost",
        type: "quantitative",
        axis: { title: "Cost of living index" },
        scale: { domain: [35, 140] },
      },
      y: {
        field: "quality",
        type: "quantitative",
        axis: { title: "Quality of living index" },
        scale: { domain: [68, 100] },
      },
      color: { field: "region", type: "nominal" },
    },
    chrome: {
      title: "The fitted line covers every region at once",
      subtitle: "Cost of living vs. quality of living in global cities, 2024",
    },
  },
});
