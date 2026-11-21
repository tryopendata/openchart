/**
 * Pure hero spec builder and form-aware spec diff over the OWID US electricity
 * generation mix dataset (2016-2023). Produces all four editorial forms (line,
 * small multiples, stacked area and data table) across every fuel spotlight,
 * keeping `@opendata-ai/openchart-core` imports strictly type-only so zero core
 * runtime code enters the up-front landing bundle.
 */

import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import type {
  ChartSpec,
  ColumnConfig,
  TableSpec,
  TextAnnotation,
} from "@opendata-ai/openchart-core";
import { sourceOf } from "../demos/source";
import { formatSpec, type MarkedSpecLine, markAddedLines } from "./spec-lines";

/** The four editorial forms available in the hero desk, in tab order. */
export const HERO_FORMS = ["line", "facets", "area", "table"] as const;
/** Identifier for one hero editorial form. */
export type HeroFormId = (typeof HERO_FORMS)[number];

/** The six US electricity generation sources in picker order. */
export const HERO_FUELS = ["Coal", "Gas", "Nuclear", "Wind", "Solar", "Hydro"] as const;
/** Identifier for one electricity generation source. */
export type HeroFuel = (typeof HERO_FUELS)[number];

/** All spotlight choices: the overview ("all") plus each individual fuel. */
export const HERO_SPOTLIGHTS = ["all", ...HERO_FUELS] as const;
/** Identifier for the active spotlight in the hero desk. */
export type HeroSpotlight = (typeof HERO_SPOTLIGHTS)[number];

/** Sources ordered by descending 2023 share so stacked bands and facets rank top-down. */
export const SOURCE_ORDER: readonly HeroFuel[] = [
  "Gas",
  "Nuclear",
  "Coal",
  "Wind",
  "Solar",
  "Hydro",
];

/** Editorial form shown on initial page load. */
export const DEFAULT_HERO_FORM: HeroFormId = "line";
/** Spotlight active on initial page load. */
export const DEFAULT_HERO_SPOTLIGHT: HeroSpotlight = "Coal";
/** Dataset citation rendered by `PublishedFigure` below the hero stage. */
export const heroSource = sourceOf(electricityMixMatrix);

/** Human-readable tab labels for the four hero editorial forms. */
export const heroFormLabels: Record<HeroFormId, string> = {
  line: "Line",
  facets: "Small multiples",
  area: "Stacked area",
  table: "Data table",
};

/** Any spec produced by the hero builder: a chart or a data table. */
export type HeroSpec = ChartSpec | TableSpec;

/** Formatted spec lines, diff flags and disclosure metadata for one hero view. */
export type HeroSpecDiff = {
  lines: MarkedSpecLine[];
  teaser: string;
  hasDiff: boolean;
  label: string;
  spec: HeroSpec;
};

type MixRow = { year: string; source: HeroFuel; share: number };
type SummaryRow = {
  source: HeroFuel;
  share2016: number;
  trend: number[];
  share2023: number;
  change: number;
};

const CHART_SUBTITLE = "Share of US electricity from six main sources, 2016–2023 (%)";
const TABLE_SUBTITLE =
  "Share of US electricity from six main sources, 2016–2023 (%). Click a row to spotlight.";
const BASELINE_TEASER = '"mark": { "type": "line", "strokeWidth": 2 }';
const TABLE_SPOTLIGHT_COLOR = "#0d9488";

const HEADLINES: Record<HeroSpotlight, string> = {
  all: "Coal's share of US electricity halved as gas and renewables grew",
  Coal: "Coal's share of US electricity halved from 31.2% in 2016 to 16.2% in 2023",
  Gas: "Natural gas climbed to 43.5% of US generation, up 8.7 points since 2016",
  Nuclear: "Nuclear held near a fifth of the grid, finishing ahead of coal in 2023",
  Wind: "Wind nearly doubled its share, passing 10% in 2022",
  Solar: "Solar quadrupled from 1.4% to 5.8%, drawing level with hydro in 2023",
  Hydro: "Hydro edged down from 6.6% to 5.8% as wind and solar caught up",
};

const callout = (x: string, y: number, text: string, dx: number, dy: number): TextAnnotation => ({
  type: "text",
  x,
  y,
  text,
  connector: true,
  offset: { dx, dy },
});

const CALLOUTS: Record<HeroFuel, TextAnnotation> = {
  Coal: callout("2023", 16.2, "Down **15 pts**\nin seven years", -76, -54),
  Gas: callout("2023", 43.5, "**43.5%** in 2023\n+8.7 pts", -76, 34),
  Nuclear: callout("2023", 18.6, "**18.6%** in 2023\n#2 source", -76, -44),
  Wind: callout("2022", 10.4, "Passed **10%**\nin 2022", -48, -38),
  Solar: callout("2023", 5.8, "**4x** share\n1.4% to 5.8%", -76, -46),
  Hydro: callout("2023", 5.8, "**5.8%** in 2023\n−0.8 pts", -76, -46),
};

const MIX_ROWS: MixRow[] = electricityMixMatrix.data
  .map((row) => ({ year: row.year, source: row.source, share: row.share ?? 0 }))
  .sort(
    (a, b) =>
      SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) ||
      Number(a.year) - Number(b.year),
  );

const SUMMARY_ROWS: SummaryRow[] = SOURCE_ORDER.map((source) => {
  const trend = MIX_ROWS.filter((row) => row.source === source).map((row) => row.share);
  const share2016 = trend[0] ?? 0;
  const share2023 = trend[trend.length - 1] ?? 0;
  const change = Number((share2023 - share2016).toFixed(1));
  return { source, share2016, trend, share2023, change };
});

const mixData = (): MixRow[] => MIX_ROWS.map((row) => ({ ...row }));
const summaryData = (): SummaryRow[] =>
  SUMMARY_ROWS.map((row) => ({ ...row, trend: [...row.trend] }));

const YEAR_CHANNEL = { field: "year", type: "temporal" as const, axis: { format: "%Y" } };
const SHARE_Y_AXIS = { format: ".0f", labelSuffix: "%", grid: true };

const colorChannel = (spotlight: HeroSpotlight) => ({
  field: "source",
  type: "nominal" as const,
  scale: { domain: [...SOURCE_ORDER] },
  ...(spotlight !== "all" ? { highlight: [spotlight] } : {}),
});

const chartChrome = (spotlight: HeroSpotlight) => ({
  title: HEADLINES[spotlight],
  subtitle: CHART_SUBTITLE,
});

function buildLineSpec(spotlight: HeroSpotlight): ChartSpec {
  const base = {
    mark: { type: "line" as const, strokeWidth: 2 },
    data: mixData(),
    chrome: chartChrome(spotlight),
    encoding: {
      x: YEAR_CHANNEL,
      y: {
        field: "share",
        type: "quantitative" as const,
        scale: { domain: [0, 50] },
        axis: { title: "Share of six-source mix", ...SHARE_Y_AXIS },
      },
      color: colorChannel(spotlight),
    },
  };
  return spotlight === "all"
    ? { ...base, endpointLabels: false, legend: { position: "top" } }
    : { ...base, endpointLabels: { content: "label" }, annotations: [CALLOUTS[spotlight]] };
}

function buildFacetsSpec(spotlight: HeroSpotlight): ChartSpec {
  return {
    mark: { type: "line", strokeWidth: 2 },
    data: mixData(),
    chrome: chartChrome(spotlight),
    encoding: {
      x: YEAR_CHANNEL,
      y: { field: "share", type: "quantitative", scale: { domain: [0, 50] }, axis: SHARE_Y_AXIS },
      color: colorChannel(spotlight),
      facet: { field: "source", type: "nominal", columns: 3, sort: null },
    },
    legend: { show: false },
  };
}

function buildAreaSpec(spotlight: HeroSpotlight): ChartSpec {
  return {
    mark: "area",
    data: mixData(),
    chrome: chartChrome(spotlight),
    encoding: {
      x: YEAR_CHANNEL,
      y: {
        field: "share",
        type: "quantitative",
        stack: "normalize",
        axis: { title: "Share of six-source mix", format: ".0%", grid: true },
      },
      color: colorChannel(spotlight),
    },
    legend: spotlight === "all" ? { show: false } : { position: "top" },
    endpointLabels: { content: "label" },
  };
}

const VALUE_COLUMNS: ColumnConfig[] = [
  {
    key: "share2016",
    label: "2016 (%)",
    format: ".1f",
    align: "right",
    sortable: true,
    priority: 3,
  },
  { key: "trend", label: "2016–2023", sparkline: { type: "line", domain: "shared" }, priority: 2 },
  { key: "share2023", label: "2023 (%)", format: ".1f", bar: {}, sortable: true, priority: 2 },
  {
    key: "change",
    label: "Change (pts)",
    format: "+.1f",
    align: "right",
    sortable: true,
    priority: 2,
  },
];

function buildTableSpec(spotlight: HeroSpotlight): TableSpec {
  const sourceColumn: ColumnConfig = {
    key: "source",
    label: "Source",
    sortable: true,
    priority: 1,
    ...(spotlight !== "all" ? { categoryColors: { [spotlight]: TABLE_SPOTLIGHT_COLOR } } : {}),
  };
  return {
    type: "table",
    data: summaryData(),
    chrome: { title: HEADLINES[spotlight], subtitle: TABLE_SUBTITLE },
    sort: { column: "share2023", direction: "desc" },
    columns: [sourceColumn, ...VALUE_COLUMNS],
  };
}

const SPEC_BUILDERS: Record<HeroFormId, (spotlight: HeroSpotlight) => HeroSpec> = {
  line: buildLineSpec,
  facets: buildFacetsSpec,
  area: buildAreaSpec,
  table: buildTableSpec,
};

/** Builds the validated OpenChart spec for a given editorial form and fuel spotlight. */
export function buildHeroSpec(form: HeroFormId, spotlight: HeroSpotlight): HeroSpec {
  return SPEC_BUILDERS[form](spotlight);
}

function pickTeaser(lines: readonly MarkedSpecLine[], needles: readonly string[]): string {
  const added = lines.filter((line) => line.added);
  for (const needle of needles) {
    const match = added.find((line) => line.text.includes(needle));
    if (match) return match.text.trim();
  }
  return added[0]?.text.trim() ?? lines[0]?.text.trim() ?? "";
}

function diffBaseline(
  form: HeroFormId,
  spotlight: HeroSpotlight,
): { spec: object; needles: string[] } {
  if (form === "line") return { spec: buildHeroSpec("line", "all"), needles: ['"highlight":'] };
  if (form === "facets") {
    return {
      spec: buildHeroSpec("line", spotlight),
      needles: ['"columns": 3', '"facet": {', '"field": "source"'],
    };
  }
  if (form === "area") {
    return {
      spec: buildHeroSpec("line", spotlight),
      needles: ['"stack": "normalize"', '"mark": "area"'],
    };
  }
  if (spotlight === "all") {
    return { spec: { type: "table", data: summaryData() }, needles: ['"sparkline":', '"bar":'] };
  }
  return { spec: buildHeroSpec("table", "all"), needles: ['"categoryColors":'] };
}

/** Formats the active hero spec and marks the lines added relative to its form baseline. */
export function heroSpecDiff(form: HeroFormId, spotlight: HeroSpotlight): HeroSpecDiff {
  const spec = buildHeroSpec(form, spotlight);
  const current = formatSpec(spec);
  const label = `${heroFormLabels[form]} · ${spotlight === "all" ? "All sources" : spotlight}`;
  if (form === "line" && spotlight === "all") {
    return {
      lines: current.map((line) => ({ ...line, added: false })),
      teaser: BASELINE_TEASER,
      hasDiff: false,
      label,
      spec,
    };
  }
  const baseline = diffBaseline(form, spotlight);
  const lines = markAddedLines(formatSpec(baseline.spec), current);
  return { lines, teaser: pickTeaser(lines, baseline.needles), hasDiff: true, label, spec };
}
