/**
 * The one small spec the framework tabs render in all four wrappers: solar
 * capacity added worldwide each year, from the IEA series in examples/src/data.
 * Five rows, so every sample stays short enough to read in one screen.
 */
import { renewableCapacityAdditions } from "@datasets/renewable-capacity";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../../../demos/source";

/** The dataset's citation; the figure caption under the chart carries it. */
export const benchSource = sourceOf(renewableCapacityAdditions);

const solar = renewableCapacityAdditions.data
  .filter((row) => row.type === "Solar")
  .map(({ year, capacity }) => ({ year, capacity }));

export const benchSpec: ChartSpec = {
  mark: "bar",
  data: solar,
  encoding: {
    x: { field: "year", type: "ordinal" },
    y: { field: "capacity", type: "quantitative", axis: { title: "Gigawatts added" } },
  },
  chrome: {
    title: "Solar additions more than tripled from 2019 to 2023",
    subtitle: "New solar generating capacity worldwide, gigawatts per year",
  },
};
