/**
 * Demos for the beeswarm page (docs/distribution/beeswarm). Specs follow the
 * beeswarm story in the Ladle scatter and distribution gallery, on a smaller
 * seeded sample.
 */
import { defineDemo } from "../types";
import { COUNTIES_PER_REGION, countyIncomes, ILLUSTRATIVE } from "./shared";

const caption = `A seeded sample of ${countyIncomes.length} invented counties, ${COUNTIES_PER_REGION} in each of four regions.`;

const incomeAxis = { title: "Median household income ($K)" };

export const singleLaneBeeswarm = defineDemo({
  id: "distribution/beeswarm-single",
  title: "County incomes in one swarm",
  source: ILLUSTRATIVE,
  caption,
  height: 340,
  spec: {
    mark: "beeswarm",
    data: countyIncomes,
    encoding: {
      x: { field: "income", type: "quantitative", axis: incomeAxis },
    },
    chrome: {
      title: "Incomes bunch in the middle and thin at the edges",
      subtitle: "Median household income by county. Each dot is one county.",
    },
  },
});

export const laneBeeswarm = defineDemo({
  id: "distribution/beeswarm-lanes",
  title: "County incomes by region",
  source: ILLUSTRATIVE,
  caption,
  height: 480,
  spec: {
    mark: "beeswarm",
    data: countyIncomes,
    encoding: {
      x: { field: "income", type: "quantitative", axis: incomeAxis },
      y: { field: "region", type: "nominal" },
      color: { field: "region", type: "nominal" },
    },
    legend: { show: false },
    chrome: {
      title: "The Northeast earns more, the South sits lower",
      subtitle: "Median household income by county, grouped by region",
    },
  },
});

export const verticalBeeswarm = defineDemo({
  id: "distribution/beeswarm-vertical",
  title: "County incomes, vertical swarms",
  source: ILLUSTRATIVE,
  caption,
  height: 480,
  spec: {
    mark: "beeswarm",
    data: countyIncomes,
    encoding: {
      x: { field: "region", type: "nominal" },
      y: { field: "income", type: "quantitative", axis: incomeAxis },
      color: { field: "region", type: "nominal" },
    },
    legend: { show: false },
    chrome: {
      title: "The same swarms on a vertical value axis",
      subtitle: "Median household income by county, grouped by region",
    },
  },
});

export const sizedBeeswarm = defineDemo({
  id: "distribution/beeswarm-sized",
  title: "County incomes, sized by population",
  source: ILLUSTRATIVE,
  caption,
  height: 480,
  spec: {
    mark: "beeswarm",
    data: countyIncomes,
    encoding: {
      x: { field: "income", type: "quantitative", axis: incomeAxis },
      y: { field: "region", type: "nominal" },
      color: { field: "region", type: "nominal" },
      size: { field: "population", type: "quantitative", scale: { range: [3, 9] } },
    },
    legend: { show: false },
    chrome: {
      title: "Bigger counties are drawn as bigger dots",
      subtitle: "Median household income by county, dot size shows population (thousands)",
    },
  },
});
