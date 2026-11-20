/**
 * The scroll story's chart and steps: four US stock indexes from January 2022,
 * told in four paragraphs. `storyBaseSpec` is the chart the story starts from;
 * each step's `change` is a deep-partial patch that `createChartStory` merges
 * onto it cumulatively. Arrays replace rather than merge, so a step that adds an
 * annotation restates the ones before it.
 */
import { indexTotalReturns } from "@datasets/index-total-returns";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import type { StoryStep } from "@opendata-ai/openchart-vanilla/story";

/** One step of the landing story. */
export type LandingStoryStep = {
  /** Stable id, unique across the steps. */
  id: string;
  /** The paragraph shown for this step. It is about the data, not the library. */
  prose: string;
  /** The change to the chart, applied cumulatively by `createChartStory` or `<ChartStory>`. */
  change: StoryStep;
};

/** Where the story's numbers come from, as the figure caption cites it. */
export const storySource = {
  label: indexTotalReturns.source.replace(/^Source:\s*/, ""),
  url: indexTotalReturns.url,
};

const allRows = indexTotalReturns.data.map((row) => ({ ...row }));
const sp500Rows = allRows.filter((row) => row.index === "S&P 500");

/** The story opens on one index and reveals the other three, so the axis is fixed to fit all four. */
const RETURN_DOMAIN: [number, number] = [-40, 70];

/** The chart before any step: the S&P 500 alone. */
export const storyBaseSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2 },
  data: sp500Rows,
  encoding: {
    x: { field: "date", type: "temporal", axis: { tickCount: 5 } },
    y: {
      field: "totalReturn",
      type: "quantitative",
      scale: { domain: RETURN_DOMAIN },
      axis: { title: "Total return since Jan 2022 (%)", format: "+.0f", grid: true },
    },
    color: { field: "index", type: "nominal" },
  },
  chrome: {
    title: "A bear market in 2022, then four very different recoveries",
    subtitle: "Cumulative total return since January 2022, quarterly, %",
  },
  // createChartStory skips the entrance when `animation` is omitted; the landing
  // page wants the line to draw in when the story scrolls into view.
  animation: true,
};

const selloff = {
  id: "selloff-2022",
  type: "range",
  x1: "2022-01-01",
  x2: "2023-01-01",
  label: "2022",
  labelAnchor: "top",
} as const;

const nasdaqTrough = {
  id: "nasdaq-trough",
  type: "text",
  x: "2023-01-01",
  y: -33.1,
  text: "Nasdaq, January 2023: **−33%**",
  anchor: "right",
  offset: { dx: 14, dy: 6 },
  connector: true,
} as const;

/** The story's four steps, in scroll order. */
export const storySteps: LandingStoryStep[] = [
  {
    id: "selloff",
    prose:
      "Over 2022 the S&P 500 lost 18% of its value, dividends included. By July 2023 it was back above where it started.",
    change: { spec: { annotations: [selloff] } },
  },
  {
    id: "other-indexes",
    prose:
      "The other three big indexes fell in the same year, by different amounts. The Dow Jones lost 13% at its low, the small companies in the Russell 2000 lost 22%.",
    change: { spec: { data: allRows } },
  },
  {
    id: "nasdaq-trough",
    prose:
      "The Nasdaq fell furthest: by January 2023 a third of its value was gone, and it was still below its 2022 level a year later.",
    change: { spec: { annotations: [selloff, nasdaqTrough] } },
  },
  {
    id: "nasdaq-recovery",
    prose:
      "It also climbed furthest. By October 2025 the Nasdaq was up 65% on January 2022, against 46% for the S&P 500 and 22% for the Russell 2000.",
    change: { spec: { encoding: { color: { highlight: ["NASDAQ"] } } } },
  },
];
