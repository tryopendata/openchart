/** GDP races for the catalog, with one dataset shared by all five figures. */
import { worldGdpRace, worldGdpRaceSource } from "@datasets/world-gdp-race";
import type { RaceSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const source = sourceOf({ source: worldGdpRaceSource });
const title = "The world's largest economies";
const bar: RaceSpec = {
  type: "race",
  mark: "bar",
  data: worldGdpRace.map(({ country, year, gdp }) => ({ country, year, gdp: gdp * 1e9 })),
  encoding: {
    time: { field: "year", type: "quantitative", format: "d" },
    key: { field: "country", type: "nominal" },
    value: { field: "gdp", type: "quantitative", format: "$.3~s" },
  },
  chrome: { title, subtitle: "Annual GDP in current US dollars", source: worldGdpRaceSource },
};
const line: RaceSpec = { ...bar, mark: "line" };
const table: RaceSpec = {
  ...bar,
  mark: { type: "table", columns: ["rank", "change", "name", "value"] },
};
const figure = { title, source, height: 490, phoneHeight: 530, entrance: false };

export const gdpRace = defineDemo({
  ...figure,
  id: "change-over-time/race",
  spec: bar,
  caption: "Switch marks at any year to see the same data as bars, lines or ranked rows.",
  controls: {
    states: {
      initialLabel: "Bar",
      others: [
        { label: "Line", spec: line },
        { label: "Table", spec: table },
      ],
    },
  },
});

export const gdpRaceLine = defineDemo({
  ...figure,
  id: "change-over-time/race-line",
  spec: line,
  caption: "The lines trace GDP through the current year.",
});

export const gdpRaceTable = defineDemo({
  ...figure,
  id: "change-over-time/race-table",
  spec: table,
  caption: "The change column shows how many places an economy moved since the previous year.",
});

export const gdpRaceLoop = defineDemo({
  ...figure,
  id: "change-over-time/race-loop",
  spec: { ...bar, race: { top: 5, loop: true } },
  caption: "The top five replay after a short hold on 2024.",
});

export const gdpRaceFixed = defineDemo({
  ...figure,
  id: "change-over-time/race-fixed",
  spec: { ...bar, race: { rescale: "fixed" } },
  caption: "With a fixed scale, a dollar spans the same distance in 1980 and 2024.",
});
