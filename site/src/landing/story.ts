/**
 * The scroll story's chart and steps: four US stock indexes from January 2022,
 * told in five paragraphs. The first frames the story and changes nothing (the
 * chart mounts at it); each of the other four makes one change on scroll. `storyBaseSpec` is the chart the story starts from;
 * each step's `change` is a deep-partial patch that `createChartStory` merges
 * onto it cumulatively. Arrays replace rather than merge, so a step that adds an
 * annotation restates the ones before it.
 *
 * The dataset's quarterly points are derived from annual total returns, so the
 * prose cites year-end figures and the last point, never an intra-year low.
 */
import { indexTotalReturns } from "@datasets/index-total-returns";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import type { StoryStep } from "@opendata-ai/openchart-vanilla/story";
import { sourceOf } from "../demos/source";

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
const indexSource = sourceOf(indexTotalReturns);
export const storySource = {
  ...indexSource,
  // The dataset's citation leaves out FTSE Russell, which publishes the Russell 2000.
  label: `${indexSource.label}, FTSE Russell`,
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
    title: "Four US stock indexes fell in 2022 and were all higher by late 2025",
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
  text: "Nasdaq, end of 2022: **−33%**",
  anchor: "right",
  offset: { dx: 14, dy: 6 },
  connector: true,
} as const;

/** The story's steps, in scroll order: an opening that changes nothing, then four changes. */
export const storySteps: LandingStoryStep[] = [
  {
    id: "opening",
    prose:
      "Four indexes follow different parts of the US stock market: the 500 largest companies, the technology-heavy Nasdaq, the 30 stocks of the Dow Jones and the 2,000 smaller companies of the Russell 2000. The chart starts with the S&P 500, measured from January 2022 with dividends reinvested.",
    change: {},
  },
  {
    id: "selloff",
    prose:
      "Over 2022 the S&P 500 lost 18% of its value. In 2023 it gained 26%, enough to finish the year above where it started.",
    change: { spec: { annotations: [selloff] } },
  },
  {
    id: "other-indexes",
    prose:
      "The other three fell in 2022 too, by different amounts. The Dow Jones lost 7% over the year, the Russell 2000 lost 21%.",
    change: { spec: { data: allRows } },
  },
  {
    id: "nasdaq-trough",
    prose:
      "The Nasdaq fell furthest, losing a third of its value in 2022. Even after a strong 2023 it finished that year below where it started.",
    change: { spec: { annotations: [selloff, nasdaqTrough] } },
  },
  {
    id: "nasdaq-recovery",
    prose:
      "It also climbed furthest. By October 2025 the Nasdaq was up 65% on January 2022, against 46% for the S&P 500, 43% for the Dow and 22% for the Russell 2000.",
    change: { spec: { encoding: { color: { highlight: ["NASDAQ"] } } } },
  },
];
