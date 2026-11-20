/**
 * Demos for the waffle page (docs/part-to-whole/waffle). The first two follow
 * the Ladle waffle demo; `units`, `columns` and `other` are the mark options
 * listed in docs/chart-types.md.
 */
import { co2Emissions } from "@datasets/co2-emissions";
import { electricityMix } from "@datasets/electricity-mix";
import { federalBudget } from "@datasets/federal-budget";
import { defineDemo } from "../types";
import { sourceOf } from "./source";

export const basicWaffle = defineDemo({
  id: "part-to-whole/waffle-basic",
  title: "Global electricity generation by source",
  source: sourceOf(electricityMix),
  height: 460,
  spec: {
    mark: "waffle",
    data: [...electricityMix["2023"]],
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: { field: "source", type: "nominal" },
    },
    chrome: {
      title: "Coal still generates about a third of the world's electricity",
      subtitle:
        "Share of global electricity generation, 2023. Each square is one percent; shares round to whole cells.",
    },
  },
});

export const highlightedWaffle = defineDemo({
  id: "part-to-whole/waffle-highlight",
  title: "Renewables picked out in the electricity mix",
  source: sourceOf(electricityMix),
  height: 460,
  spec: {
    mark: "waffle",
    data: [...electricityMix["2023"]],
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: { field: "source", type: "nominal", highlight: "Renewables" },
    },
    chrome: {
      title: "Renewables generated about 16 of every 100 kilowatt-hours",
      subtitle: "Share of global electricity generation, 2023. Each square is one percent.",
    },
  },
});

export const smallerWaffle = defineDemo({
  id: "part-to-whole/waffle-units",
  title: "Federal spending on a 50-cell grid",
  source: sourceOf(federalBudget),
  height: 380,
  spec: {
    mark: { type: "waffle", units: 50, columns: 10 },
    data: [...federalBudget.data],
    encoding: {
      theta: { field: "spending", type: "quantitative" },
      color: { field: "category", type: "nominal" },
    },
    chrome: {
      title: "Fifty cells make each square two percent",
      subtitle: "Share of federal spending by category, fiscal year 2024",
    },
  },
});

export const bucketedWaffle = defineDemo({
  id: "part-to-whole/waffle-other",
  title: "CO2 emissions with small emitters bucketed",
  source: sourceOf(co2Emissions),
  height: 460,
  spec: {
    mark: { type: "waffle", other: { threshold: 0.05, label: "Other emitters" } },
    data: [...co2Emissions.data],
    encoding: {
      theta: { field: "emissions", type: "quantitative" },
      color: { field: "country", type: "nominal" },
    },
    chrome: {
      title: "Countries under 5% fold into one category",
      subtitle: "Annual CO₂ emissions among the top twelve emitters, 2024",
    },
  },
});
