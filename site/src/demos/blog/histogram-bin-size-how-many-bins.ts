/**
 * The figures in the blog post "Histogram bin size: how many bins": the 2024
 * median household income of 50 states and DC drawn with $25,000, $10,000 and
 * $1,000 bins, then a month of earthquake counts drawn with 0.1 and 0.5
 * magnitude bins. Every chart bins in the spec with a `bin` transform, so the
 * demo module only picks the width. Titles state findings computed from the
 * dataset rows so they cannot drift from the data. The post's `json demo` fence
 * repeats `incomeTenThousand.spec` verbatim, and a test holds the two together.
 */
import { earthquakeMagnitudes } from "@datasets/earthquake-magnitudes";
import { stateMedianHouseholdIncome } from "@datasets/state-median-household-income";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";

const incomes = stateMedianHouseholdIncome.data.map((row) => ({
  state: row.state_name,
  income: row.income_2024,
}));

/** Every income chart starts its bins here and ends at the same edge, so the widths compare. */
const INCOME_START = 50_000;
const INCOME_END = 125_000;

/** How many values fall in each non-empty bin of this width, counted straight from the rows. */
export function binCounts(values: number[], start: number, step: number): number[] {
  const counts = new Map<number, number>();
  for (const value of values) {
    const bin = Math.floor((value - start) / step);
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a - b).map(([, count]) => count);
}

const incomeValues = incomes.map((row) => row.income);
const dollars = (value: number) => `$${value.toLocaleString("en-US")}`;

function incomeHistogram(step: number, title: string): ChartSpec {
  return {
    mark: { type: "bar", fill: ACCENT },
    data: incomes,
    transform: [
      { bin: { step, extent: [INCOME_START, INCOME_END] }, field: "income", as: ["from", "to"] },
      {
        aggregate: [{ op: "count", field: "state", as: "states" }],
        groupby: ["from", "to"],
      },
    ],
    encoding: {
      x: {
        field: "from",
        type: "quantitative",
        scale: { domain: [INCOME_START, INCOME_END], nice: false },
        axis: {
          title: "Median household income, 2024",
          format: "$~s",
          values: [60000, 80000, 100000, 120000],
        },
      },
      x2: { field: "to", type: "quantitative" },
      y: {
        field: "states",
        type: "quantitative",
        axis: { title: "States per bin", tickCount: 4 },
      },
    },
    chrome: {
      title,
      subtitle: `Number of states by median household income in ${dollars(step)} bins, 50 states and DC`,
    },
  };
}

const coarse = binCounts(incomeValues, INCOME_START, 25_000);
const medium = binCounts(incomeValues, INCOME_START, 10_000);
const fine = binCounts(incomeValues, INCOME_START, 1_000);
/** States in the two $10,000 bins from $70,000 to $90,000. */
const middleStates = incomeValues.filter((value) => value >= 70_000 && value < 90_000).length;

const source = sourceOf(stateMedianHouseholdIncome);

export const incomeTwentyFiveThousand = defineDemo({
  id: "blog/income-bins-25000",
  title: "State median household income in $25,000 bins",
  source,
  height: 380,
  spec: incomeHistogram(
    25_000,
    `With $25,000 bins the ${incomes.length} states make ${coarse.length} bars and no shape`,
  ),
});

export const incomeTenThousand = defineDemo({
  id: "blog/income-bins-10000",
  title: "State median household income in $10,000 bins",
  source,
  height: 380,
  spec: incomeHistogram(
    10_000,
    `${middleStates} of ${incomes.length} states sit between $70,000 and $90,000, with a tail to the right`,
  ),
});

export const incomeThousand = defineDemo({
  id: "blog/income-bins-1000",
  title: "State median household income in $1,000 bins",
  source,
  height: 380,
  spec: incomeHistogram(
    1_000,
    `With $1,000 bins there are ${fine.length} bars and none holds more than ${Math.max(...fine)} states`,
  ),
});

/** The counts the post quotes, exported so the test pins them. */
export const incomeBinFacts = { coarse, medium, fine, middleStates };

const quakes = earthquakeMagnitudes.data;
const total = quakes.reduce((sum, row) => sum + row.quakes, 0);
const dip = quakes.find((row) => row.magnitude_bin === 3.9);
const rebound = quakes.find((row) => row.magnitude_bin === 4.5);

/**
 * The rows are already counts per 0.1 bin, so the 0.1 chart draws them as they
 * are, each bar ending 0.1 above its start. Binning them again would let float
 * error push a value such as 2.8 into the 2.7 bin. Wider bins merge the rows
 * with a `bin` transform and a sum; their edges (x.0 and x.5) are exact in binary.
 */
function quakeHistogram(step: number, title: string, annotate: boolean): ChartSpec {
  const merged = step !== 0.1;
  return {
    mark: { type: "bar", fill: ACCENT },
    data: quakes.map((row) => ({
      ...row,
      magnitude_to: Math.round(row.magnitude_bin * 10 + 1) / 10,
    })),
    ...(merged
      ? {
          transform: [
            { bin: { step, extent: [2, 7] }, field: "magnitude_bin", as: ["from", "to"] },
            {
              aggregate: [{ op: "sum" as const, field: "quakes", as: "count" }],
              groupby: ["from", "to"],
            },
          ],
        }
      : {}),
    encoding: {
      x: {
        field: merged ? "from" : "magnitude_bin",
        type: "quantitative",
        scale: { domain: [2, 7], nice: false },
        axis: { title: "Magnitude", tickCount: 6 },
      },
      x2: { field: merged ? "to" : "magnitude_to", type: "quantitative" },
      y: {
        field: merged ? "count" : "quakes",
        type: "quantitative",
        axis: { title: "Quakes per bin", tickCount: 4 },
      },
    },
    ...(annotate && dip
      ? {
          annotations: [
            {
              type: "text" as const,
              x: 3.95,
              y: dip.quakes,
              text: `**M3.9**\n${dip.quakes} quakes`,
              anchor: "top" as const,
              offset: { dx: 0, dy: -110 },
              connector: "curve" as const,
            },
          ],
        }
      : {}),
    chrome: {
      title,
      subtitle: `Magnitude 2.5+ earthquakes in ${step} magnitude bins, ${total.toLocaleString("en-US")} quakes, January 2026`,
    },
  };
}

const quakeSource = sourceOf(earthquakeMagnitudes);

export const quakesTenth = defineDemo({
  id: "blog/quakes-bins-0-1",
  title: "Earthquake counts in 0.1 magnitude bins",
  source: quakeSource,
  height: 420,
  spec: quakeHistogram(
    0.1,
    `Counts fall to ${dip?.quakes} at magnitude 3.9, then climb back to ${rebound?.quakes} at 4.5`,
    true,
  ),
});

export const quakesHalf = defineDemo({
  id: "blog/quakes-bins-0-5",
  title: "Earthquake counts in 0.5 magnitude bins",
  source: quakeSource,
  height: 380,
  spec: quakeHistogram(0.5, "Half-magnitude bins keep the dip and smooth the spikes", false),
});
