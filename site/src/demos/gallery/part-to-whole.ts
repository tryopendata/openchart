/**
 * The gallery's part-to-whole graphics: US generation from six sources in 2023
 * as a waffle and every year from 2016 to 2023 stacked to 100%
 * (`electricity-mix-matrix`), US energy use by fuel in 2024 as a donut, and
 * each end-use sector's split between energy services and rejected energy
 * (`us-energy-flow-2024`). Ported from the Ladle pie and donut, and bar and
 * column galleries, rebuilt on these tier-1 datasets.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usEnergyFlow2024 } from "@datasets/us-energy-flow-2024";
import { sourceOf } from "../source";
import { ACCENT, GREY } from "../the-spec/shared";
import { defineDemo } from "../types";
import { energyThrough, FUELS, MIX_MEASURE, mixIn, mixRows, SECTORS, SOURCES } from "./shared";

const LATEST = "2023";
const RENEWABLES = ["Wind", "Solar"] as const;
const RENEWABLE_SET = new Set<string>(RENEWABLES);

export const electricityWaffle = defineDemo({
  id: "gallery/electricity-waffle",
  title: "US generation from six sources in 100 squares, 2023",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: "waffle",
    data: mixIn(LATEST),
    encoding: {
      theta: { field: "share", type: "quantitative" },
      color: {
        field: "source",
        type: "nominal",
        scale: { domain: [...SOURCES] },
        highlight: ["Nuclear", ...RENEWABLES],
      },
    },
    chrome: {
      title: "Nuclear generated more than wind and solar together in 2023",
      subtitle: `${MIX_MEASURE}, ${LATEST}. Each square is one percent; shares round to whole squares.`,
    },
  },
});

export const electricityShareColumns = defineDemo({
  id: "gallery/electricity-share-columns",
  title: "Share of generation from six sources by year, stacked to 100%",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: "bar",
    // Segments stack in row order, so wind and solar's rows come first to sit on the baseline.
    data: [...mixRows].sort(
      (a, b) => Number(!RENEWABLE_SET.has(a.source)) - Number(!RENEWABLE_SET.has(b.source)),
    ),
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: {
        field: "share",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of generation", format: ".0%", grid: true },
      },
      color: {
        field: "source",
        type: "nominal",
        // The wall's one order for these sources, so each keeps its color on every chart.
        scale: { domain: [...SOURCES] },
        highlight: [...RENEWABLES],
      },
    },
    labels: false,
    chrome: {
      title:
        "Wind and solar's share of generation from six sources more than doubled, 2016 to 2023",
      subtitle: `${MIX_MEASURE}, each year stacked to 100%`,
    },
  },
});

/** The fuels a donut can tell apart; the rest are summed as "Other". */
const NAMED_FUELS = ["Petroleum", "Natural gas", "Nuclear", "Coal", "Biomass"] as const;
const OTHER_FUELS = FUELS.filter((fuel) => !(NAMED_FUELS as readonly string[]).includes(fuel));
const round2 = (value: number) => Math.round(value * 100) / 100;
const energyBySource = [
  ...NAMED_FUELS.map((fuel) => ({ source: fuel, quads: round2(energyThrough(fuel)) })),
  {
    source: "Other",
    quads: round2(OTHER_FUELS.reduce((sum, fuel) => sum + energyThrough(fuel), 0)),
  },
];
const totalQuads = energyBySource.reduce((sum, row) => sum + row.quads, 0);
const oilAndGasPercent = Math.round(
  ((energyThrough("Petroleum") + energyThrough("Natural gas")) / totalQuads) * 100,
);

export const energySourcesDonut = defineDemo({
  id: "gallery/energy-sources-donut",
  title: "US energy use by source, 2024",
  source: sourceOf(usEnergyFlow2024),
  caption: `Other is ${OTHER_FUELS.slice(0, -1).join(", ").toLowerCase()} and ${OTHER_FUELS.at(-1)?.toLowerCase()}.`,
  height: 440,
  spec: {
    mark: {
      type: "arc",
      innerRadius: 64,
      centerLabel: { text: `${oilAndGasPercent}%`, subtitle: "oil and gas" },
    },
    data: energyBySource,
    encoding: {
      theta: { field: "quads", type: "quantitative" },
      color: {
        field: "source",
        type: "nominal",
        scale: { domain: [...NAMED_FUELS, "Other"] },
      },
    },
    // Outside slice labels clip on a phone; the legend names the slices at every width.
    labels: false,
    chrome: {
      title: `Petroleum and natural gas supplied ${oilAndGasPercent}% of the energy the US used in 2024`,
      subtitle: "Primary energy by source, 2024 (quadrillion BTU)",
    },
  },
});

/** Each sector's quads, split into the energy that did useful work and the energy lost. */
const sectorRows = SECTORS.flatMap((sector) => {
  const services = usEnergyFlow2024.data.find(
    (link) => link.source === sector && link.target === "Energy services",
  );
  const rejected = usEnergyFlow2024.data.find(
    (link) => link.source === sector && link.target === "Rejected energy",
  );
  if (!services || !rejected) {
    throw new Error(`us-energy-flow-2024 has no services or rejected energy link for ${sector}.`);
  }
  return [
    { sector, outcome: "Energy services", quads: services.value },
    { sector, outcome: "Rejected energy", quads: rejected.value },
  ];
});
/** The share of a sector's energy that became energy services, in whole percent. */
export function servicesPercent(sector: string): number {
  const rows = sectorRows.filter((row) => row.sector === sector);
  const services = rows.find((row) => row.outcome === "Energy services")?.quads ?? 0;
  return Math.round((services / rows.reduce((sum, row) => sum + row.quads, 0)) * 100);
}

export const energyServicesBySector = defineDemo({
  id: "gallery/energy-services-by-sector",
  title: "Energy services and rejected energy by sector, 2024",
  source: sourceOf(usEnergyFlow2024),
  caption:
    "Energy services is the energy that did useful work; rejected energy was lost, mostly as heat.",
  height: 360,
  spec: {
    mark: { type: "bar", orient: "horizontal" },
    data: sectorRows,
    encoding: {
      x: {
        field: "quads",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of the sector's energy", format: ".0%", grid: true },
      },
      y: { field: "sector", type: "nominal", sort: null },
      color: {
        field: "outcome",
        type: "nominal",
        scale: { domain: ["Energy services", "Rejected energy"], range: [ACCENT, GREY] },
      },
    },
    labels: false,
    chrome: {
      title: `Transportation turned ${servicesPercent("Transportation")}% of its energy into energy services, the least of four sectors`,
      subtitle: "Energy used by each end-use sector, 2024, split by what became of it",
    },
  },
});
