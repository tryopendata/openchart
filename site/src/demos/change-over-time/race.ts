/** GDP races for the catalog, with one dataset shared by all five figures. */
import { worldGdpRace, worldGdpRaceSource } from "@datasets/world-gdp-race";
import type { RaceSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const source = sourceOf({ source: worldGdpRaceSource });
const barTitle = "China passed Japan";
const lineTitle = "US GDP grew tenfold";
const tableTitle = "China was No. 2 in 2024";
const loopTitle = "The US led every year";
const fixedTitle = "US GDP reached $28.8T";
const subtitle = "Annual GDP in current US dollars";
const bar: RaceSpec = {
  type: "race",
  mark: "bar",
  data: worldGdpRace.map(({ country, year, gdp }) => ({ country, year, gdp: gdp * 1e9 })),
  encoding: {
    time: { field: "year", type: "quantitative", format: "d" },
    key: { field: "country", type: "nominal" },
    value: { field: "gdp", type: "quantitative", format: "$.3~s" },
  },
  chrome: { title: barTitle, subtitle },
};
const line: RaceSpec = { ...bar, mark: "line" };
const table: RaceSpec = { ...bar, mark: "table" };
const figure = { source, height: 490, phoneHeight: 530, entrance: false };

export const gdpRace = defineDemo({
  ...figure,
  id: "change-over-time/race",
  title: barTitle,
  spec: bar,
  caption:
    "China moved into second place in 2010. Switch marks to see the same data as bars, lines or ranked rows.",
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
  title: lineTitle,
  spec: { ...line, chrome: { title: lineTitle, subtitle } },
  caption: "The lines trace GDP through the current year.",
});

export const gdpRaceTable = defineDemo({
  ...figure,
  id: "change-over-time/race-table",
  title: tableTitle,
  spec: { ...table, chrome: { title: tableTitle, subtitle } },
  caption: "The change column shows how many places an economy moved since the previous year.",
});

export const gdpRaceLoop = defineDemo({
  ...figure,
  id: "change-over-time/race-loop",
  title: loopTitle,
  spec: {
    ...bar,
    chrome: { title: loopTitle, subtitle },
    race: { top: 5, loop: true },
  },
  caption: "The top five replay after a short hold on 2024.",
});

export const gdpRaceFixed = defineDemo({
  ...figure,
  id: "change-over-time/race-fixed",
  title: fixedTitle,
  spec: {
    ...bar,
    chrome: { title: fixedTitle, subtitle },
    race: { rescale: "fixed" },
  },
  caption: "With a fixed scale, a dollar spans the same distance in 1980 and 2024.",
});
