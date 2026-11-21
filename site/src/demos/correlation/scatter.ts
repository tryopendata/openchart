/**
 * Demos for the scatter page (docs/correlation/scatter). Specs follow the
 * scatter stories in the Ladle scatter and distribution gallery.
 */
import { costOfLiving } from "@datasets/cost-of-living";
import { pisaScores } from "@datasets/pisa-scores";
import { wealthHealth } from "@datasets/wealth-health";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const spendingAxis = { title: "Spending per student ($K, PPP)" };
const mathAxis = { title: "PISA math score" };

export const basicScatter = defineDemo({
  id: "correlation/scatter-basic",
  title: "School spending and math scores",
  source: sourceOf(pisaScores),
  height: 440,
  spec: {
    mark: "point",
    data: [...pisaScores.data],
    encoding: {
      x: { field: "spending", type: "quantitative", axis: spendingAxis },
      y: { field: "math", type: "quantitative", axis: mathAxis },
      tooltip: [
        { field: "country", type: "nominal", title: "Country" },
        { field: "spending", type: "quantitative", title: "Spending ($K)" },
        { field: "math", type: "quantitative", title: "Math score" },
      ],
    },
    chrome: {
      title: "Switzerland spends the most per student; Singapore scores highest",
      subtitle: "Cumulative per-student spending vs. PISA 2022 math performance, OECD countries",
    },
  },
});

export const labelledScatter = defineDemo({
  id: "correlation/scatter-labelled",
  title: "School spending and math scores, annotated",
  source: sourceOf(pisaScores),
  height: 460,
  spec: {
    mark: "point",
    data: [...pisaScores.data],
    encoding: {
      x: { field: "spending", type: "quantitative", axis: spendingAxis },
      y: { field: "math", type: "quantitative", axis: mathAxis },
    },
    annotations: [
      {
        type: "text",
        x: 14.5,
        y: 575,
        text: "Singapore",
        anchor: "left",
        fontSize: 10,
        dot: false,
      },
      {
        type: "text",
        x: 14.3,
        y: 465,
        text: "United States",
        anchor: "right",
        fontSize: 10,
        dot: false,
      },
      { type: "text", x: 8.4, y: 510, text: "Estonia", anchor: "left", fontSize: 10, dot: false },
      { type: "refline", y: 472, label: "OECD avg", style: "dashed", stroke: "#64748b" },
    ],
    chrome: {
      title: "The US spends about as much as Singapore and scores 110 points lower",
      subtitle: "Cumulative per-student spending vs. PISA 2022 math performance, OECD countries",
    },
  },
});

export const coloredScatter = defineDemo({
  id: "correlation/scatter-color",
  title: "Cost and quality of living by region",
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
      tooltip: [
        { field: "city", type: "nominal", title: "City" },
        { field: "cost", type: "quantitative", title: "Cost index" },
        { field: "quality", type: "quantitative", title: "Quality index" },
        { field: "region", type: "nominal", title: "Region" },
      ],
    },
    chrome: {
      title: "Vienna and Montreal rate higher than New York and cost less",
      subtitle: "Cost of living vs. quality of living in global cities, 2024",
    },
  },
});

export const logScatter = defineDemo({
  id: "correlation/scatter-log",
  title: "Wealth and life expectancy on a log axis",
  source: sourceOf(wealthHealth),
  height: 460,
  spec: {
    mark: "point",
    data: [...wealthHealth.data],
    encoding: {
      x: {
        field: "gdpPerCapita",
        type: "quantitative",
        scale: { type: "log" },
        axis: { title: "GDP per capita (USD, log scale)", format: "$.2~s" },
      },
      y: {
        field: "lifeExpectancy",
        type: "quantitative",
        axis: { title: "Life expectancy (years)" },
      },
      color: { field: "region", type: "nominal" },
    },
    chrome: {
      title: "A log axis spreads out the poorest countries",
      subtitle: "GDP per capita vs. life expectancy, 2022",
    },
  },
});
