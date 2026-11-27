/**
 * The edit section's chart: one line with one callout the reader can move.
 * Lane 3a writes the real spec.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";

/** The chart the edit section mounts in edit mode. */
export const editSpec: ChartSpec = {
  mark: "line",
  data: [],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "value", type: "quantitative" },
  },
};

/** The figure's source line. */
export const editSource = { label: "", href: "" };
