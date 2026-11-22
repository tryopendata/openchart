/**
 * The figures in the blog post "Accessible charts for the web": synthetic
 * opioid and heroin overdose deaths with an authored text alternative and a
 * dash pattern, then the NFL home win rate with the description the library
 * generates. Titles and the alternative text are computed from the dataset
 * rows so they cannot drift from the data. The post's `json demo` fence
 * repeats `overdoseAccessible.spec` verbatim, and a test keeps the two in sync.
 */
import { cdcOverdoseByDrug } from "@datasets/cdc-overdose-by-drug";
import { nflHomeAdvantage } from "@datasets/nfl-home-advantage";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/**
 * The two overdose series as light/dark pairs. Each is also its end label's
 * text color, so each value clears 4.5:1 on its own page: the light values on
 * white, the dark ones on the dark page (#0e0f10) and its panel (#17181a).
 */
const TEAL = { light: "#0e7490", dark: "#22a3c4" };
const ORANGE = { light: "#b54d00", dark: "#f07a2b" };

const overdoseRows = cdcOverdoseByDrug.data;
const nflRows = nflHomeAdvantage.data;

const fmt = (n: number) => n.toLocaleString("en-US");

const overdoseLong = overdoseRows.flatMap((row) => [
  { year: String(row.year), drug: "Synthetic opioids", deaths: row.synthetic_opioids },
  { year: String(row.year), drug: "Heroin", deaths: row.heroin },
]);

const passed = overdoseRows.find((row) => row.synthetic_opioids > row.heroin);
if (!passed) throw new Error("Synthetic opioids never passed heroin in the CDC rows");
const peak = overdoseRows.reduce((best, row) =>
  row.synthetic_opioids > best.synthetic_opioids ? row : best,
);
const last = overdoseRows.at(-1);
if (!last) throw new Error("The CDC rows are empty");
const fallPct = Math.round((1 - last.synthetic_opioids / peak.synthetic_opioids) * 100);

export const overdoseAccessible = defineDemo({
  id: "blog/overdose-accessible",
  title: "US overdose deaths from synthetic opioids and heroin, with authored alt text",
  source: sourceOf(cdcOverdoseByDrug),
  height: 440,
  spec: {
    mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
    a11y: {
      description: `Synthetic opioid overdose deaths passed heroin deaths in ${passed.year}, ${fmt(passed.synthetic_opioids)} to ${fmt(passed.heroin)}, and peaked at ${fmt(peak.synthetic_opioids)} in ${peak.year}. By ${last.year} they had fallen ${fallPct}% from the peak, to ${fmt(last.synthetic_opioids)}.`,
    },
    data: overdoseLong,
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y" } },
      y: {
        field: "deaths",
        type: "quantitative",
        axis: { title: "Deaths, 12 months ending December", format: ",.0f", grid: true },
      },
      color: {
        field: "drug",
        type: "nominal",
        scale: { domain: ["Synthetic opioids", "Heroin"] },
      },
      strokeDash: { field: "drug", type: "nominal" },
    },
    theme: { colors: { categorical: [TEAL, ORANGE] } },
    legend: { show: false },
    endpointLabels: { format: ",.0f" },
    chromeLayout: "subtract",
    chrome: {
      title: `Synthetic opioids passed heroin in ${passed.year} and peaked at ${fmt(peak.synthetic_opioids)} deaths in ${peak.year}`,
      subtitle: `US overdose deaths involving each drug, 12 months ending December, ${overdoseRows[0]?.year}-${last.year}`,
    },
  },
});

const below = nflRows.find((row) => row.home_win_pct < 50);
if (!below) throw new Error("No NFL season has a home win rate under 50%");
const first = nflRows[0];
if (!first) throw new Error("The NFL rows are empty");

const nflSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2.5, interpolate: "linear" },
  data: nflRows.map((row) => ({ season: String(row.season), home_win_pct: row.home_win_pct })),
  encoding: {
    x: { field: "season", type: "temporal", axis: { format: "%Y" } },
    y: {
      field: "home_win_pct",
      type: "quantitative",
      scale: { domain: [40, 65], zero: false },
      axis: { title: "Home team wins", format: ".0f", labelSuffix: "%", grid: true },
    },
  },
  // The rule color is also its label's text color; the default grey is 3.5:1 on white.
  theme: { colors: { annotationRule: { light: "#6b6b66", dark: "#a3a39c" } } },
  annotations: [
    {
      type: "refline",
      y: 50,
      label: "Even odds",
      style: "dashed",
      labelPlacement: "start",
      labelAnchor: "top",
    },
    {
      type: "text",
      x: String(below.season),
      y: below.home_win_pct,
      text: `${below.season}: ${below.home_win_pct.toFixed(1)}%`,
      anchor: "bottom",
      offset: { dx: 0, dy: 30 },
      connector: true,
    },
  ],
  chromeLayout: "subtract",
  chrome: {
    title: `NFL home teams won ${first.home_win_pct.toFixed(1)}% of games in ${first.season} and ${below.home_win_pct.toFixed(1)}% in ${below.season}`,
    subtitle: `Share of regular-season games won by the home team, ${first.season}-${nflRows.at(-1)?.season}. Ties count as half a win.`,
  },
};

export const nflHomeGenerated = defineDemo({
  id: "blog/nfl-home-generated",
  title: "NFL home win rate, with the alt text the library generates",
  source: sourceOf(nflHomeAdvantage),
  height: 400,
  spec: nflSpec,
});
