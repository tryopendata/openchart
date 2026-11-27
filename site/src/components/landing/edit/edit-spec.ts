/**
 * The edit section's chart and its source: US inflation, 2019 to 2024, with the
 * one callout the reader can move and a dashed line at the Fed's 2% target.
 * Rows come from the us-inflation dataset the edit mode docs page already uses.
 *
 * The callout is the spec's first annotation, which is the only thing
 * `acceptedOffset` lets an edit change. It sets `anchor` and `responsive`
 * explicitly because a move from the library writes both: matching values make
 * those writes no-ops, so a plain move is accepted as only an offset change.
 */
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec, TextAnnotation } from "@opendata-ai/openchart-core";
import { sourceOf } from "../../../demos/source";
import type { DemoSource } from "../../../demos/types";
import type { Offset } from "./callout-offset";

/** Where the spec puts the callout, from its default spot right of the peak. */
export const startOffset: Offset = { dx: 112, dy: 8 };

/** The callout the reader moves. */
const peakCallout: TextAnnotation = {
  type: "text",
  x: "2022-07-01",
  y: 8.5,
  text: "Peak of 8.5%\nin summer 2022",
  anchor: "right",
  offset: { ...startOffset },
  connector: true,
  // Keeps the callout on the line on a phone: a note band would grow the chart past its fixed box.
  responsive: false,
};

/** The editable chart: inflation's climb to 8.5% and its slide back toward the target. */
export const editSpec: ChartSpec = {
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
    peakCallout,
    { type: "refline", y: 2, label: "Fed's 2% target", style: "dashed", strokeWidth: 1 },
  ],
  chrome: {
    title: "US inflation is most of the way back down",
    subtitle: "Consumer prices, change from a year earlier, quarterly, 2019 to 2024 (%)",
  },
};

/** The figure's source line. */
export const editSource: DemoSource = sourceOf(usInflation);
