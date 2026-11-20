/**
 * Demos for the pie and donut page (docs/part-to-whole/pie-donut). Specs follow
 * the Ladle pie and donut gallery; each takes its data and citation from one
 * dataset module in examples/src/data.
 */
import { browserShare } from "@datasets/browser-share";
import { co2Emissions } from "@datasets/co2-emissions";
import { federalBudget } from "@datasets/federal-budget";
import { usHouse } from "@datasets/parliament-seats";
import { smartphoneShare } from "@datasets/smartphone-share";
import { defineDemo } from "../types";
import { sourceOf } from "./source";

// The lead pie is about labels, so every slice stays above the ~3% grouping
// threshold: the small browsers fold into the one "Others" slice up front.
const KEPT_BROWSERS = new Set(["Chrome", "Safari", "Edge"]);
const browserPieData = [
  ...browserShare.data.filter((row) => KEPT_BROWSERS.has(row.browser)),
  {
    browser: "Others",
    share:
      Math.round(
        browserShare.data
          .filter((row) => !KEPT_BROWSERS.has(row.browser))
          .reduce((sum, row) => sum + row.share, 0) * 10,
      ) / 10,
  },
];

export const basicPie = defineDemo({
  id: "part-to-whole/pie-basic",
  title: "Browser share",
  source: sourceOf(browserShare),
  height: 480,
  spec: {
    mark: "arc",
    data: browserPieData,
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: { field: "browser", type: "nominal" },
    },
    chrome: {
      title: "Chrome owns nearly two-thirds of the browser market",
      subtitle: "Global desktop and mobile browser share, January 2024 (%)",
    },
  },
});

export const donut = defineDemo({
  id: "part-to-whole/donut",
  title: "Federal spending by category",
  source: sourceOf(federalBudget),
  height: 480,
  spec: {
    mark: { type: "arc", innerRadius: 0.6 },
    data: [...federalBudget.data],
    encoding: {
      theta: { field: "spending", type: "quantitative" },
      color: { field: "category", type: "nominal" },
    },
    chrome: {
      title: "Healthcare and Social Security take nearly half the budget",
      subtitle: "Share of $6.9 trillion in federal spending, fiscal year 2024",
    },
  },
});

export const donutCenterLabel = defineDemo({
  id: "part-to-whole/donut-center-label",
  title: "Federal spending with a center label",
  source: sourceOf(federalBudget),
  height: 480,
  spec: {
    mark: {
      type: "arc",
      innerRadius: 0.6,
      centerLabel: { text: "$6.9T", subtitle: "total outlays" },
    },
    data: [...federalBudget.data],
    encoding: {
      theta: { field: "spending", type: "quantitative" },
      color: { field: "category", type: "nominal" },
    },
    chrome: {
      title: "The hole can carry the total",
      subtitle: "Share of $6.9 trillion in federal spending, fiscal year 2024",
    },
  },
});

export const groupedSlices = defineDemo({
  id: "part-to-whole/pie-small-slices",
  title: "CO2 emissions by country",
  source: sourceOf(co2Emissions),
  height: 520,
  spec: {
    mark: "arc",
    data: [...co2Emissions.data],
    encoding: {
      theta: { field: "emissions", type: "quantitative" },
      color: { field: "country", type: "nominal" },
    },
    chrome: {
      title: "China and the US drive nearly half of top-emitter CO₂",
      subtitle:
        'Annual CO₂ emissions, million tonnes, 2024. Slices under about 3% are grouped into "Other".',
    },
  },
});

export const leaderLineDonut = defineDemo({
  id: "part-to-whole/donut-leader-lines",
  title: "Smartphone market share by vendor",
  source: sourceOf(smartphoneShare),
  height: 520,
  spec: {
    mark: { type: "arc", innerRadius: 0.6 },
    data: [...smartphoneShare.data],
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: { field: "brand", type: "nominal" },
    },
    chrome: {
      title: "Apple reclaimed the top spot from Samsung in Q4",
      subtitle: "Global smartphone market share by vendor, Q4 2024 (%)",
    },
  },
});

export const halfDonut = defineDemo({
  id: "part-to-whole/donut-half",
  title: "House seats as a half donut",
  source: sourceOf(usHouse),
  height: 420,
  spec: {
    mark: {
      type: "arc",
      innerRadius: 0.6,
      startAngle: -Math.PI / 2,
      endAngle: Math.PI / 2,
    },
    data: [...usHouse.data],
    encoding: {
      theta: { field: "seats", type: "quantitative" },
      color: {
        field: "party",
        type: "nominal",
        scale: { domain: ["Democratic", "Republican"], range: [...usHouse.colors] },
      },
    },
    chrome: {
      title: "A half donut of chamber control",
      subtitle: "435 House seats drawn as a 180-degree arc with startAngle and endAngle.",
    },
  },
});
