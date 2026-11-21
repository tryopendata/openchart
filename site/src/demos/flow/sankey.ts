/**
 * Demos for the sankey page (docs/flow/sankey). Specs follow the sankey section
 * of the Ladle sankey and tile map gallery and docs/sankey.md; each takes its
 * rows and citation from one dataset module in examples/src/data, except the
 * three-column energy flow, which is illustrative and labelled so. The basic
 * sankey, which the landing page also shows, is the LLNL 2024 US energy flow.
 * Sankeys have no static SVG, so each figure reserves its height and draws once
 * the page's script mounts it.
 */
import { budgetFlow } from "@datasets/budget-flow";
import { usEnergyFlow2024 } from "@datasets/us-energy-flow-2024";
import { userJourney } from "@datasets/user-journey";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/**
 * A three-column energy flow (source, carrier, sector, quadrillion BTU) shaped
 * like the EIA's annual flow diagram. The magnitudes are illustrative, not a
 * transcription of EIA figures, so the caption says so. The rows are kept here
 * rather than imported because the dataset module cites EIA as if they were.
 */
const illustrativeEnergyFlow = {
  source: "Illustrative data, after the EIA annual energy flow",
  data: [
    { source: "Coal", target: "Electricity", value: 46.5 },
    { source: "Natural Gas", target: "Electricity", value: 38.2 },
    { source: "Natural Gas", target: "Heating", value: 25.8 },
    { source: "Nuclear", target: "Electricity", value: 19.7 },
    { source: "Solar", target: "Electricity", value: 10.3 },
    { source: "Wind", target: "Electricity", value: 14.1 },
    { source: "Petroleum", target: "Transport", value: 55.4 },
    { source: "Petroleum", target: "Industry", value: 12.3 },
    { source: "Electricity", target: "Residential", value: 38.5 },
    { source: "Electricity", target: "Commercial", value: 35.8 },
    { source: "Electricity", target: "Industry", value: 34.5 },
    { source: "Heating", target: "Residential", value: 15.2 },
    { source: "Heating", target: "Commercial", value: 10.6 },
    { source: "Transport", target: "Passenger", value: 32.1 },
    { source: "Transport", target: "Freight", value: 23.3 },
  ],
};

/** Every flow dataset names its columns source, target and value. */
const flowEncoding = (format: string) =>
  ({
    source: { field: "source", type: "nominal" },
    target: { field: "target", type: "nominal" },
    value: { field: "value", type: "quantitative", format },
  }) as const;

export const basicSankey = defineDemo({
  id: "flow/sankey-basic",
  title: "US energy from source to end use in 2024",
  source: sourceOf(usEnergyFlow2024),
  height: 620,
  spec: {
    type: "sankey",
    data: [...usEnergyFlow2024.data],
    encoding: flowEncoding(".2f"),
    chrome: {
      // 62.27 of the 94.61 quads reaching the two end nodes (62.27 + 32.34) is 65.8%.
      title: "Rejected energy was 66% of US energy consumption in 2024",
      subtitle:
        "Energy from each fuel through electricity generation and end-use sectors, 2024 (quadrillion BTU)",
    },
  },
});

export const funnelSankey = defineDemo({
  id: "flow/sankey-funnel",
  title: "A product funnel from landing page to paid plan",
  source: sourceOf(userJourney),
  height: 440,
  spec: {
    type: "sankey",
    data: [...userJourney.data],
    encoding: flowEncoding(",.0f"),
    nodeAlign: "left",
    chrome: {
      title: "720 of 10,000 visitors became paying users",
      subtitle: "One month's visitors from landing page to plan",
    },
  },
});

export const sourceColoredSankey = defineDemo({
  id: "flow/sankey-link-color",
  title: "Energy flow with links colored by source",
  source: sourceOf(illustrativeEnergyFlow),
  height: 460,
  spec: {
    type: "sankey",
    data: [...illustrativeEnergyFlow.data],
    encoding: flowEncoding(".1f"),
    linkStyle: "source",
    chrome: {
      title: "Petroleum feeds transport and industry directly",
      subtitle: "Links take the color of the node they leave (quadrillion BTU)",
    },
  },
});

export const otherBucketSankey = defineDemo({
  id: "flow/sankey-other",
  title: "Energy flow with small sources merged",
  source: sourceOf(illustrativeEnergyFlow),
  height: 460,
  spec: {
    type: "sankey",
    data: [...illustrativeEnergyFlow.data],
    encoding: flowEncoding(".1f"),
    other: 0.07,
    chrome: {
      title: "Solar and wind merge into one node under a 7% threshold",
      subtitle: "Sources under 7% of their column's flow become Other (quadrillion BTU)",
    },
  },
});

export const currencySankey = defineDemo({
  id: "flow/sankey-budget",
  title: "Revenue streams allocated to departments",
  source: sourceOf(budgetFlow),
  height: 440,
  spec: {
    type: "sankey",
    data: [...budgetFlow.data],
    encoding: flowEncoding("$,.1f"),
    chrome: {
      title: "Engineering takes the largest share of revenue",
      subtitle: "Revenue allocation by department ($ millions)",
    },
  },
});
