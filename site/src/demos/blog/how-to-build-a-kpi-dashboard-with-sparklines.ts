/**
 * The figures in the blog post "How to build a KPI dashboard with sparklines":
 * a bare sparkline of the 30-year mortgage rate, then three KPI tiles (mortgage
 * rate, the price of a dozen eggs, the remote share of US job postings), each a
 * line chart with its axes removed and a `metrics` row that states the latest
 * value, the first value and the peak. Every number in a metrics row and every
 * title is computed from the dataset rows, so none can drift from the data. The
 * post's `json demo` fence repeats `remoteTile.spec` verbatim, and a test holds
 * the two together.
 */
import { eggPricesMonthly } from "@datasets/egg-prices-monthly";
import { mortgageRateWeekly } from "@datasets/mortgage-rate-weekly";
import { remoteJobShare } from "@datasets/remote-job-share";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ACCENT = "#0e7490";

/** One reading of a series: when it was taken and its value. */
type Point = { date: string; value: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-12" as "Nov 12, 2026". */
const dayLabel = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${day}, ${year}`;
};
/** "2025-03-01" as "Mar 2025". */
const monthLabel = (date: string) => {
  const [year, month] = date.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${year}`;
};
/** "2022-04-01" as "2022-Q2". */
const quarterLabel = (date: string) => {
  const [year, month] = date.split("-").map(Number);
  return `${year}-Q${Math.floor(((month ?? 1) - 1) / 3) + 1}`;
};

/** The weekly mortgage rate as points. */
export const mortgagePoints: Point[] = mortgageRateWeekly.data.map((row) => ({
  date: row.date,
  value: row.mortgage_rate,
}));

/** Monthly egg prices as points, rounded to the cent. */
export const eggPoints: Point[] = eggPricesMonthly.data.map((row) => ({
  date: row.date,
  value: Number(row.eggs_per_dozen.toFixed(2)),
}));

/** US remote-posting share from 2021-Q1 on, each quarter dated by its first day, to match the other tiles. */
export const remotePoints: Point[] = remoteJobShare.data
  .filter((row) => Number(row.quarter.slice(0, 4)) >= 2021)
  .map((row) => {
    const [year, quarter] = row.quarter.split("-Q").map(Number);
    const month = String(((quarter ?? 1) - 1) * 3 + 1).padStart(2, "0");
    return { date: `${year}-${month}-01`, value: row.us };
  });

const firstOf = (points: Point[]) => points[0] as Point;
const lastOf = (points: Point[]) => points.at(-1) as Point;
const peakOf = (points: Point[]) =>
  points.reduce((best, point) => (point.value > best.value ? point : best));

type TileOptions = {
  id: string;
  title: string;
  label: string;
  points: Point[];
  source: ReturnType<typeof sourceOf>;
  /** How a reading prints in a metrics cell, and how its date prints in the cell's label. */
  value: (value: number) => string;
  when: (date: string) => string;
  height?: number;
};

/** A tile: a line chart with its axes off, titled with the KPI and carrying its numbers in a metrics row. */
function kpiTile({ id, title, label, points, source, value, when, height = 380 }: TileOptions) {
  const first = firstOf(points);
  const last = lastOf(points);
  const peak = peakOf(points);
  const spec: ChartSpec = {
    mark: { type: "line", stroke: ACCENT, strokeWidth: 2, point: "last", interpolate: "linear" },
    data: points.map((point) => ({ ...point })),
    encoding: {
      x: { field: "date", type: "temporal", axis: false },
      y: { field: "value", type: "quantitative", axis: false, scale: { zero: false } },
    },
    metrics: [
      { label: `Latest, ${when(last.date)}`, value: value(last.value) },
      { label: `Start, ${when(first.date)}`, value: value(first.value) },
      { label: `Peak, ${when(peak.date)}`, value: value(peak.value) },
    ],
    // Metrics need 480px of width. Below that, the same numbers move into the title and subtitle.
    overrides: {
      compact: {
        chrome: {
          title: `${label.split(",")[0]}: ${value(last.value)}`,
          subtitle: `${when(first.date)}: ${value(first.value)}. Peak, ${when(peak.date)}: ${value(peak.value)}.`,
        },
      },
    },
    labels: { density: "none" },
    chrome: { title: label },
  };
  return defineDemo({ id, title, source, height, spec });
}

export const mortgageTile = kpiTile({
  id: "blog/kpi-tile-mortgage",
  title: "KPI tile: 30-year mortgage rate",
  label: "30-year fixed mortgage rate, weekly, %",
  points: mortgagePoints,
  source: sourceOf(mortgageRateWeekly),
  value: (value) => `${value.toFixed(2)}%`,
  when: dayLabel,
});

export const eggTile = kpiTile({
  id: "blog/kpi-tile-eggs",
  title: "KPI tile: price of a dozen eggs",
  label: "Eggs, one dozen large, monthly, $",
  points: eggPoints,
  source: sourceOf(eggPricesMonthly),
  value: (value) => `$${value.toFixed(2)}`,
  when: monthLabel,
});

export const remoteTile = kpiTile({
  id: "blog/kpi-tile-remote",
  title: "KPI tile: remote share of US job postings",
  label: "US job postings that mention remote work, quarterly, %",
  points: remotePoints,
  source: sourceOf(remoteJobShare),
  value: (value) => `${value.toFixed(2)}%`,
  when: quarterLabel,
});

/** The same weekly mortgage rates as a bare sparkline: no title, axes, number or source. */
export const mortgageSparkline = defineDemo({
  id: "blog/kpi-sparkline-bare",
  title: "A sparkline of the 30-year mortgage rate",
  source: sourceOf(mortgageRateWeekly),
  height: 56,
  spec: {
    mark: { type: "line", stroke: ACCENT, interpolate: "linear" },
    data: mortgagePoints.map((point) => ({ ...point })),
    encoding: {
      x: { field: "date", type: "temporal" },
      y: { field: "value", type: "quantitative" },
    },
    display: "sparkline",
  },
});
