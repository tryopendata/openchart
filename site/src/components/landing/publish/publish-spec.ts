/** The chart the publish section sets in an article and exports, and its source. */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import type { DemoSource } from "../../../demos/types";

/** The published chart. A placeholder until the publish lane picks its data. */
export const publishSpec: ChartSpec = {
  mark: "line",
  data: [],
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "value", type: "quantitative" },
  },
};

/** The published chart's source line. */
export const publishSource: DemoSource | undefined = undefined;
