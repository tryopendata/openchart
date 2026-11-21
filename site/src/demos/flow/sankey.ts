/**
 * Demos for the sankey page (docs/flow/sankey). Specs follow the sankey section
 * of the Ladle sankey and tile map gallery and docs/sankey.md; each takes its
 * rows and citation from one dataset module in examples/src/data. Sankeys have
 * no static SVG, so each figure reserves its height and draws once the page's
 * script mounts it.
 */
import { budgetFlow } from "@datasets/budget-flow";
import { energyFlow } from "@datasets/energy-flow";
import { userJourney } from "@datasets/user-journey";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** Every flow dataset names its columns source, target and value. */
const flowEncoding = (format: string) =>
  ({
    source: { field: "source", type: "nominal" },
    target: { field: "target", type: "nominal" },
    value: { field: "value", type: "quantitative", format },
  }) as const;

export const basicSankey = defineDemo({
  id: "flow/sankey-basic",
  title: "US energy flow from source to sector",
  source: sourceOf(energyFlow),
  height: 460,
  spec: {
    type: "sankey",
    data: [...energyFlow.data],
    encoding: flowEncoding(".1f"),
    chrome: {
      title: "Most primary energy passes through electricity",
      subtitle: "Primary sources through carriers to end-use sectors (quadrillion BTU)",
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
  source: sourceOf(energyFlow),
  height: 460,
  spec: {
    type: "sankey",
    data: [...energyFlow.data],
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
  source: sourceOf(energyFlow),
  height: 460,
  spec: {
    type: "sankey",
    data: [...energyFlow.data],
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
