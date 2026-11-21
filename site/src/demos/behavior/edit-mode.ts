/**
 * Demos for the edit mode page (docs/behavior/edit-mode): an annotated line
 * and a labelled bar chart a reader can edit in place, each with the event log
 * showing the transactions the edits produce. Each takes its rows and citation
 * from one verified dataset module.
 */
import { populationByCountry } from "@datasets/population";
import { usInflation } from "@datasets/us-inflation";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

export const editableLine = defineDemo({
  id: "behavior/edit-line",
  title: "US inflation with a note and a target line",
  source: sourceOf(usInflation),
  caption: "Drag the note, or select it and nudge it with the arrow keys.",
  height: 440,
  spec: {
    mark: { type: "line", strokeWidth: 2 },
    data: usInflation.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        axis: { title: "Inflation (%)", format: ".0f", grid: true },
      },
    },
    annotations: [
      {
        type: "text",
        x: "2022-07-01",
        y: 8.5,
        text: "Peak: 8.5%",
        anchor: "right",
        offset: { dx: 16, dy: 0 },
        connector: true,
      },
      { type: "refline", y: 2, label: "Fed 2% target", style: "dashed", strokeWidth: 1 },
    ],
    chrome: {
      title: "US inflation peaked at 8.5% in 2022 and was down to 2.6% by late 2024",
      subtitle: "US consumer prices, change from a year earlier, quarterly, 2019 to 2024 (%)",
    },
  },
  mount: { interaction: "edit" },
  controls: { eventLog: true },
});

export const editableBars = defineDemo({
  id: "behavior/edit-text",
  title: "Population of the 10 most populous countries",
  source: sourceOf(populationByCountry),
  caption: "Select the title, press Enter, type a new one and press Enter again.",
  height: 440,
  spec: {
    mark: "bar",
    data: populationByCountry.data.map((row) => ({ ...row })),
    encoding: {
      y: { field: "country", type: "nominal", sort: "x" },
      x: {
        field: "population",
        type: "quantitative",
        axis: { title: "Population", format: ".2s" },
      },
    },
    labels: { density: "all", format: ".3s" },
    chrome: {
      title: "India and China each have more than 1.4 billion people",
      subtitle: "Population of the 10 most populous countries, 2025, UN projection",
    },
  },
  mount: { interaction: "edit" },
  controls: { eventLog: true },
});
