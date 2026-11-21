/**
 * Demos for the sankey page (docs/flow/sankey). Specs follow the sankey section
 * of the Ladle sankey and tile map gallery and docs/sankey.md; each takes its
 * rows and citation from one dataset module in examples/src/data, except the
 * three-column energy flow, which is illustrative and labelled so. The basic
 * sankey, which the landing page also shows, uses verified generation shares.
 * Sankeys have no static SVG, so each figure reserves its height and draws once
 * the page's script mounts it.
 */
import { budgetFlow } from "@datasets/budget-flow";
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
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

/** The group each generation source falls in. */
const SOURCE_GROUP: Record<string, string> = {
  Coal: "Fossil fuels",
  Gas: "Fossil fuels",
  Nuclear: "Low carbon",
  Hydro: "Low carbon",
  Wind: "Low carbon",
  Solar: "Low carbon",
};

/** US 2023 generation shares, one link from each source to its group. */
const generation2023 = electricityMixMatrix.data
  .filter((row) => row.year === "2023")
  .map((row) => ({
    source: row.source,
    target: SOURCE_GROUP[row.source] ?? "Other",
    value: row.share,
  }));

export const basicSankey = defineDemo({
  id: "flow/sankey-basic",
  title: "US electricity in 2023 from source to group",
  source: sourceOf(electricityMixMatrix),
  height: 460,
  spec: {
    type: "sankey",
    data: generation2023,
    encoding: flowEncoding(".1f"),
    chrome: {
      title: "Fossil fuels made about 60% of US electricity in 2023",
      subtitle: "Share of generation from coal, gas, nuclear, hydro, wind and solar, 2023 (%)",
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
