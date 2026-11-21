/**
 * Demos the `/fixtures/controls/` page renders to exercise the demo contract's
 * reader controls (states, event log, edit mode, downloads) and the spec-theme
 * opt-out. Each takes a slice of a verified dataset. The controls runtime
 * belongs to the demo system; until it lands these figures render without bars.
 */

import { populationByCountry } from "@datasets/population";
import { usInflation } from "@datasets/us-inflation";
import { broadsheet, type ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The quarterly inflation line every fixture here starts from. */
const inflationLine = (rows: readonly { date: string; rate: number }[]): ChartSpec => ({
  mark: "line",
  data: rows.map((row) => ({ ...row })),
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "rate", type: "quantitative", title: "CPI inflation (%)" },
  },
  chrome: {
    title: "Inflation peaked at 8.5% in mid-2022",
    subtitle: "US consumer prices, change from a year earlier, quarterly (%)",
  },
});

const throughEnd2021 = usInflation.data.filter((row) => row.date < "2022-01-01");

/** The ten most populous countries as horizontal bars. */
const populationBars: ChartSpec = {
  mark: "bar",
  data: populationByCountry.data.map((row) => ({ ...row })),
  encoding: {
    y: { field: "country", type: "nominal", sort: "-x" },
    x: { field: "population", type: "quantitative", format: ".2s", title: "Population" },
  },
  chrome: {
    title: "India and China each hold more than 1.4 billion people",
    subtitle: "Population of the ten most populous countries, 2025",
  },
};

export const statesFixture = defineDemo({
  id: "fixtures/states",
  title: "US inflation in two states",
  source: sourceOf(usInflation),
  spec: inflationLine(usInflation.data),
  controls: {
    states: {
      initialLabel: "2019 to 2024",
      others: [{ label: "2019 to 2021", spec: inflationLine(throughEnd2021) }],
    },
  },
});

export const eventsFixture = defineDemo({
  id: "fixtures/events",
  title: "Population bars with an event log",
  source: sourceOf(populationByCountry),
  spec: populationBars,
  controls: { eventLog: true },
});

export const editFixture = defineDemo({
  id: "fixtures/edit",
  title: "US inflation with an editable annotation",
  source: sourceOf(usInflation),
  spec: {
    ...inflationLine(usInflation.data),
    annotations: [{ type: "text", x: "2022-07-01", y: 8.5, text: "Peak: 8.5%" }],
  },
  mount: { interaction: "edit" },
  controls: { eventLog: true },
});

export const exportFixture = defineDemo({
  id: "fixtures/export",
  title: "Population bars with downloads",
  source: sourceOf(populationByCountry),
  spec: populationBars,
  controls: { exports: ["svg", "png", "csv"] },
});

export const ownThemeFixture = defineDemo({
  id: "fixtures/own-theme",
  title: "US inflation in the broadsheet preset",
  source: sourceOf(usInflation),
  spec: { ...inflationLine(usInflation.data), theme: broadsheet },
  pageTheme: false,
});
