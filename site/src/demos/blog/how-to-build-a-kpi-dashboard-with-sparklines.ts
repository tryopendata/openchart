/**
 * The figures in the blog post "How to build a KPI dashboard with sparklines":
 * a dashboard of three KPI tiles in one faceted spec (the 30-year mortgage
 * rate, the price of a dozen eggs, the remote share of US job postings), each
 * panel titled with what it measures, how often and in what unit, and compared
 * with a year earlier in a `metrics` row (on a phone the row drops out and the
 * compact subtitle carries each latest reading and its change); then one tile
 * on its own, a line chart with its axes removed and a metrics row whose first
 * cell carries the change from a year earlier as a delta; then the mortgage rate as a sparkline titled with its number. Every
 * number in a title, metrics cell or subtitle is computed from the dataset rows,
 * so none can drift from the data. The post's `json demo` fence repeats
 * `mortgageTile.spec` verbatim, and a test holds the two together.
 */
import { eggPricesMonthly } from "@datasets/egg-prices-monthly";
import { mortgageRateWeekly } from "@datasets/mortgage-rate-weekly";
import { remoteJobShare } from "@datasets/remote-job-share";
import type { ChartSpec, Metric } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The line color as a light and dark pair, so it keeps its contrast on the dark page. */
const ACCENT = { light: "#0e7490", dark: "#22a3c4" };

/** One reading of a series: when it was taken and its value. A null value is a missing reading. */
type Point = { date: string; value: number | null };
type Reading = { date: string; value: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
/** "2026-11-12" as "Nov 12, 2026". */
const dayLabel = (date: string) => {
  const [year, month, day] = parts(date);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
};
/** "2025-03-01" as "Mar 2025". */
const monthLabel = (date: string) => {
  const [year, month] = parts(date);
  return `${MONTHS[month - 1]} ${year}`;
};
/** "2022-04-01" as "2022-Q2". */
const quarterLabel = (date: string) => {
  const [year, month] = parts(date);
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
};

/** The weekly mortgage rate as points. */
export const mortgagePoints: Point[] = mortgageRateWeekly.data.map((row) => ({
  date: row.date,
  value: row.mortgage_rate,
}));

/**
 * Monthly egg prices as points, rounded to the cent, with a null point for any
 * month the source skips (it has no October 2025 price), so the line breaks there
 * instead of bridging the gap.
 */
export const eggPoints: Point[] = (() => {
  const byDate = new Map(eggPricesMonthly.data.map((row) => [row.date, row.eggs_per_dozen]));
  const first = parts(eggPricesMonthly.data[0]?.date ?? "2021-01-01");
  const last = parts(eggPricesMonthly.data.at(-1)?.date ?? "2021-01-01");
  const points: Point[] = [];
  for (let index = first[0] * 12 + first[1] - 1; index <= last[0] * 12 + last[1] - 1; index++) {
    const date = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
    const price = byDate.get(date);
    points.push({ date, value: price === undefined ? null : Number(price.toFixed(2)) });
  }
  return points;
})();

/** US remote-posting share from 2021-Q1 on, each quarter dated by its first day, to match the other tiles. */
export const remotePoints: Point[] = remoteJobShare.data
  .filter((row) => Number(row.quarter.slice(0, 4)) >= 2021)
  .map((row) => {
    const [year, quarter] = row.quarter.split("-Q").map(Number);
    const month = String(((quarter ?? 1) - 1) * 3 + 1).padStart(2, "0");
    return { date: `${year}-${month}-01`, value: row.us };
  });

const readings = (points: Point[]) =>
  points.filter((point): point is Reading => point.value !== null);
const lastOf = (points: Point[]) => readings(points).at(-1) as Reading;
const peakOf = (points: Point[]) =>
  readings(points).reduce((best, point) => (point.value > best.value ? point : best));
const DAY = 86_400_000;
/**
 * The reading a year before the latest one: the closest reading at or before
 * the same date a year earlier, within the series' own spacing. When the source
 * skipped that month, this is the reading before the gap, and its label says so.
 */
export const yearAgoOf = (points: Point[]) => {
  const last = lastOf(points);
  const [year, month, day] = parts(last.date);
  const target = Date.UTC(year - 1, month - 1, day);
  return readings(points)
    .filter((point) => Date.parse(point.date) <= target + 3 * DAY)
    .at(-1) as Reading;
};

/** How each KPI prints: its name for a panel or a title, its values, its changes and its dates. */
type Kpi = {
  name: string;
  period: string;
  unit: string;
  points: Point[];
  value: (value: number) => string;
  change: (delta: number) => string;
  when: (date: string) => string;
};

const signed = (delta: number, digits: number) =>
  `${delta < 0 ? "−" : "+"}${Math.abs(delta).toFixed(digits)}`;
const percent = (value: number) => `${value.toFixed(2)}%`;
const points = (delta: number) => `${signed(delta, 2)} pts`;

const mortgage: Kpi = {
  name: "Mortgage rate",
  period: "weekly",
  unit: "%",
  points: mortgagePoints,
  value: percent,
  change: points,
  when: dayLabel,
};
const eggs: Kpi = {
  name: "Eggs, a dozen",
  period: "monthly",
  unit: "$",
  points: eggPoints,
  value: (value) => `$${value.toFixed(2)}`,
  change: (delta) => `${delta < 0 ? "−" : "+"}$${Math.abs(delta).toFixed(2)}`,
  when: monthLabel,
};
const remote: Kpi = {
  name: "Remote job ads",
  period: "quarterly",
  unit: "%",
  points: remotePoints,
  value: percent,
  change: points,
  when: quarterLabel,
};

/** The latest reading, the one a year earlier and the change between them, as printed. */
export function comparisonOf(kpi: Kpi) {
  const last = lastOf(kpi.points);
  const before = yearAgoOf(kpi.points);
  const delta = last.value - before.value;
  return {
    latest: kpi.value(last.value),
    latestWhen: kpi.when(last.date),
    yearAgo: kpi.value(before.value),
    yearAgoWhen: kpi.when(before.date),
    change: kpi.change(delta),
    tone: (delta < 0 ? "down" : "up") as Metric["deltaTone"],
  };
}

/** A panel title: what was measured, how often and in what unit. */
const panelTitle = (kpi: Kpi) => `${kpi.name}, ${kpi.period}, ${kpi.unit}`;
/** The latest reading and its change from a year earlier, for a phone subtitle. */
const latestWithChange = (kpi: Kpi) => {
  const comparison = comparisonOf(kpi);
  return `${kpi.name.split(",")[0]?.toLowerCase()} ${comparison.latest} (${comparison.change})`;
};

const KPIS = [mortgage, eggs, remote];

/** The three dataset citations, one per tile; a dashboard cites every source it draws. */
const dashboardSource = {
  label: [mortgageRateWeekly, eggPricesMonthly, remoteJobShare]
    .map((dataset) => sourceOf(dataset).label)
    .join("; "),
};

/**
 * The dashboard: one faceted line chart, a panel per KPI with its own y scale.
 * Panels wrap three across on a desktop and stack on a phone (each needs 200px).
 * The metrics row lines up a year-earlier comparison over each panel; it needs
 * 480px, so on a phone the compact subtitle carries each latest reading and its change.
 */
export const kpiDashboard = defineDemo({
  id: "blog/kpi-dashboard",
  title: "A dashboard of three KPI tiles: mortgage rate, egg prices and remote job ads",
  source: dashboardSource,
  height: 620,
  spec: {
    mark: { type: "line", strokeWidth: 2, interpolate: "linear" },
    data: KPIS.flatMap((kpi) =>
      kpi.points.map((point) => ({ tile: panelTitle(kpi), date: point.date, value: point.value })),
    ),
    encoding: {
      x: { field: "date", type: "temporal", axis: false },
      y: { field: "value", type: "quantitative", axis: false, scale: { zero: false } },
      facet: {
        field: "tile",
        type: "nominal",
        sort: null,
        columns: 3,
      },
    },
    resolve: { scale: { y: "independent" } },
    metrics: KPIS.map((kpi) => {
      const comparison = comparisonOf(kpi);
      return {
        label: `vs ${comparison.yearAgoWhen}: ${comparison.yearAgo}`,
        value: comparison.latest,
        delta: comparison.change,
        deltaTone: comparison.tone,
      };
    }),
    overrides: {
      compact: {
        chrome: {
          title: "Three KPIs since 2021",
          subtitle: `Latest, and change from a year earlier: ${KPIS.map(latestWithChange).join(", ")}.`,
        },
      },
    },
    // A tighter outer padding gives each of three panels the 200px a panel needs in a 656px column.
    theme: { colors: { categorical: [ACCENT] }, spacing: { padding: 4 } },
    chrome: {
      title: "Three KPIs, January 2021 to latest",
      subtitle:
        "Latest reading over each panel, with its change from a year earlier. Each line has its own scale.",
    },
  },
});

/** The mortgage tile on its own: the latest rate with its change from a year earlier, the year-earlier rate and the peak. */
const mortgageComparison = comparisonOf(mortgage);
const mortgagePeak = peakOf(mortgagePoints);
const mortgageLast = lastOf(mortgagePoints);
const mortgageTileSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2, point: "last", interpolate: "linear" },
  data: mortgagePoints.map((point) => ({ ...point })),
  encoding: {
    x: { field: "date", type: "temporal", axis: false },
    y: { field: "value", type: "quantitative", axis: false, scale: { zero: false } },
  },
  metrics: [
    {
      label: `Latest, ${dayLabel(mortgageLast.date)}`,
      value: mortgageComparison.latest,
      delta: mortgageComparison.change,
      deltaTone: mortgageComparison.tone,
    },
    {
      label: `A year earlier, ${mortgageComparison.yearAgoWhen}`,
      value: mortgageComparison.yearAgo,
    },
    { label: `Peak, ${dayLabel(mortgagePeak.date)}`, value: percent(mortgagePeak.value) },
  ],
  // Metrics need 480px of width. Below that, the same numbers move into the title and subtitle.
  overrides: {
    compact: {
      chrome: {
        title: `30-year mortgage rate, weekly: ${mortgageComparison.latest}`,
        subtitle: `${mortgageComparison.change} from a year earlier (${mortgageComparison.yearAgo} on ${mortgageComparison.yearAgoWhen}). Peak, ${dayLabel(mortgagePeak.date)}: ${percent(mortgagePeak.value)}.`,
      },
    },
  },
  theme: { colors: { categorical: [ACCENT] } },
  chrome: { title: "30-year fixed mortgage rate, weekly, %" },
};

export const mortgageTile = defineDemo({
  id: "blog/kpi-tile-mortgage",
  title: "KPI tile: 30-year mortgage rate",
  source: sourceOf(mortgageRateWeekly),
  height: 380,
  spec: mortgageTileSpec,
});

/**
 * The weekly mortgage rate as a sparkline with its number: `display: "sparkline"`
 * strips the axes, gridlines, legend and source, and an explicit `chrome.title`
 * stays, so the number sits above the line.
 */
export const mortgageSparkline = defineDemo({
  id: "blog/kpi-sparkline-bare",
  title: "A sparkline of the 30-year mortgage rate",
  source: sourceOf(mortgageRateWeekly),
  height: 120,
  spec: {
    // A sparkline takes a rising or falling trend color unless the stroke is set.
    mark: { type: "line", interpolate: "linear", stroke: ACCENT.light },
    data: mortgagePoints.map((point) => ({ ...point })),
    encoding: {
      x: { field: "date", type: "temporal" },
      // Headroom above the 7.79% peak keeps the line clear of the title.
      y: { field: "value", type: "quantitative", scale: { domain: [2, 10] } },
    },
    display: "sparkline",
    chrome: { title: `Mortgage rate, weekly: ${comparisonOf(mortgage).latest}` },
  },
});
