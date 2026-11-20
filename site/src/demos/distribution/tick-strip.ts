/**
 * Demos for the tick strip page (docs/distribution/tick-strip). Specs follow the
 * tick and strip plot story in the Ladle scatter and distribution gallery.
 */
import { incomeDistribution } from "@datasets/income-distribution";
import { marathonFinishTimes } from "@datasets/marathon-finish-times";
import { defineDemo } from "../types";
import { ILLUSTRATIVE } from "./shared";

const marathonCaption = "Invented finish times: 35 runners across five age groups.";

const hoursAxis = { title: "Finish time (hours)" };

export const basicTickStrip = defineDemo({
  id: "distribution/tick-basic",
  title: "Marathon finish times by age group",
  source: ILLUSTRATIVE,
  caption: marathonCaption,
  height: 420,
  spec: {
    mark: "tick",
    data: [...marathonFinishTimes.data],
    encoding: {
      x: { field: "hours", type: "quantitative", axis: hoursAxis },
      y: { field: "group", type: "nominal", axis: { title: "Age group" } },
    },
    chrome: {
      title: "26 of 35 finishers took five hours or less",
      subtitle: "Individual marathon finishers by age group. Each tick is one runner.",
    },
  },
});

export const groupedTickStrip = defineDemo({
  id: "distribution/tick-groups",
  title: "Marathon finish times, colored by age group",
  source: ILLUSTRATIVE,
  caption: marathonCaption,
  height: 420,
  spec: {
    mark: "tick",
    data: [...marathonFinishTimes.data],
    encoding: {
      x: { field: "hours", type: "quantitative", axis: hoursAxis },
      y: { field: "group", type: "nominal", axis: { title: "Age group" } },
      color: { field: "group", type: "nominal" },
    },
    legend: { show: false },
    chrome: {
      title: "Finish times spread wider with age",
      subtitle: "Individual marathon finishers by age group. Each tick is one runner.",
    },
  },
});

export const referenceTickStrip = defineDemo({
  id: "distribution/tick-reference",
  title: "Marathon finish times against a four-hour mark",
  source: ILLUSTRATIVE,
  caption: marathonCaption,
  height: 420,
  spec: {
    mark: "tick",
    data: [...marathonFinishTimes.data],
    encoding: {
      x: { field: "hours", type: "quantitative", axis: hoursAxis },
      y: { field: "group", type: "nominal", axis: { title: "Age group" } },
      color: { field: "group", type: "nominal" },
    },
    legend: { show: false },
    annotations: [{ type: "refline", x: 4, label: "4 hours", style: "dashed" }],
    chrome: {
      title: "Few runners over 50 break four hours",
      subtitle: "Individual marathon finishers by age group",
    },
  },
});

export const incomeTickStrip = defineDemo({
  id: "distribution/tick-income",
  title: "Household incomes by region",
  source: ILLUSTRATIVE,
  caption: "44 invented households, 11 in each Census region.",
  height: 420,
  spec: {
    mark: "tick",
    data: [...incomeDistribution.data],
    encoding: {
      x: { field: "income", type: "quantitative", axis: { title: "Household income ($K)" } },
      y: { field: "region", type: "nominal" },
      color: { field: "region", type: "nominal" },
    },
    legend: { show: false },
    chrome: {
      title: "The West and Northeast reach the highest incomes",
      subtitle: "Sampled households by Census region. Each tick is one household.",
    },
  },
});
