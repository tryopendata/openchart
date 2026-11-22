/**
 * The figures in the blog post "How to annotate a line chart without cluttering
 * it": a bare quarterly US inflation line, then the same line with a dashed 2%
 * reference line, a shaded range for the stretch above 5%, and a callout on the
 * Q3 2022 peak. Titles are computed from the rows so they cannot drift from the
 * dataset. The post's `json demo` fence repeats `inflationAnnotated.spec`
 * verbatim, and a test holds the two together.
 */
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { ACCENT, INFLATION_SUBTITLE } from "../the-spec/shared";
import { defineDemo } from "../types";

const rows = usInflation.data;
const source = sourceOf(usInflation);

const COUNT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
] as const;

function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

function quarterOf(isoDate: string): string {
  const [year = "", month = "1"] = isoDate.split("-");
  const quarter = Math.floor((Number(month) - 1) / 3) + 1;
  return `Q${quarter} ${year}`;
}

/** Highest quarterly reading in the series, called out on the annotated chart. */
const peak = rows.reduce((high, row) => (row.rate > high.rate ? row : high));
/** Latest quarterly reading in the series, named in the bare chart's title. */
const latest = rows.reduce((last, row) => (row.date > last.date ? row : last));
/** Consecutive quarters where year-over-year inflation ran above 5%. */
const aboveFive = rows.filter((row) => row.rate > 5);
const firstAboveFive = aboveFive[0];
const lastAboveFive = aboveFive.at(-1);
if (!firstAboveFive || !lastAboveFive) {
  throw new Error("Expected at least one usInflation row above 5%");
}

/** Shared quarterly CPI line before adding headroom and annotations. */
const inflationLine: ChartSpec = {
  mark: { type: "line", stroke: ACCENT, strokeWidth: 2 },
  data: rows.map((row) => ({ ...row })),
  encoding: {
    x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
    y: {
      field: "rate",
      type: "quantitative",
      axis: { title: "Change from a year earlier", format: ".0f", labelSuffix: "%" },
    },
  },
};

export const inflationBare = defineDemo({
  id: "blog/inflation-bare",
  title: "US inflation from 2019 to 2024 without annotations",
  source,
  height: 400,
  spec: {
    ...inflationLine,
    chrome: {
      title: `US inflation peaked at ${peak.rate}% in ${quarterOf(peak.date)} and ended ${latest.date.slice(0, 4)} at ${latest.rate}%`,
      subtitle: INFLATION_SUBTITLE,
    },
  },
});

export const inflationAnnotated = defineDemo({
  id: "blog/inflation-annotated",
  title: "US inflation with a target line, shaded range, and peak callout",
  source,
  height: 420,
  spec: {
    ...inflationLine,
    encoding: {
      ...inflationLine.encoding,
      // Headroom above the 8.5% peak keeps the range label clear of the curve.
      y: { ...inflationLine.encoding.y, scale: { domain: [0, 10] } },
    },
    annotations: [
      {
        type: "refline",
        y: 2,
        label: "Fed 2% target",
        style: "dashed",
        strokeWidth: 1.5,
        labelPlacement: "end",
        labelAnchor: "bottom",
      },
      {
        type: "range",
        x1: firstAboveFive.date,
        x2: lastAboveFive.date,
        label: "Above 5%",
        opacity: 0.12,
      },
      {
        type: "text",
        x: peak.date,
        y: peak.rate,
        text: `**${peak.rate}% peak**\n${quarterOf(peak.date)}`,
        anchor: "right",
        offset: { dx: 24, dy: 4 },
        connector: "curve",
      },
    ],
    chrome: {
      title: `US inflation stayed above 5% for ${countWord(aboveFive.length)} quarters and peaked at ${peak.rate}% in ${quarterOf(peak.date)}`,
      subtitle: INFLATION_SUBTITLE,
    },
  },
});
