/**
 * The figures in the blog post "When to use an animated chart instead of small
 * multiples": the World Bank wealth-and-health data three ways. The bubble playback
 * is the other post's `blog/wealth-health-playback`; this module adds the paths of
 * five countries as a connected scatter (playback trails, opened on the last year)
 * and four years side by side as small multiples. The post prints the connected
 * scatter in its `json demo` fence; a test holds the fence to `wealthHealthPaths.spec`.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { defineDemo } from "../types";
import {
  FIRST_YEAR,
  LAST_YEAR,
  wealthHealthEncoding,
  wealthHealthRows,
  wealthHealthSource,
} from "./how-to-make-an-animated-bubble-chart-in-javascript";

/** The countries the connected scatter follows. */
export const PATH_COUNTRIES = ["China", "India", "Nigeria", "South Korea", "United States"];

/**
 * A connected scatter as a playback: trails on every key, opened on the final year
 * with `animation: false`, so each country's whole path is drawn when the chart
 * mounts. A line mark can't draw it, because a line sorts its points by x.
 */
const pathsSpec: ChartSpec = {
  mark: "point",
  data: wealthHealthRows
    .filter((row) => PATH_COUNTRIES.includes(row.country))
    .map(({ country, year, gdp, life }) => ({
      country,
      year,
      gdp: gdp === null ? null : Math.round(gdp),
      life: life === null ? null : Math.round(life * 10) / 10,
    })),
  encoding: {
    x: wealthHealthEncoding.x,
    y: wealthHealthEncoding.y,
    color: { field: "country", type: "nominal" },
    key: wealthHealthEncoding.key,
    time: wealthHealthEncoding.time,
  },
  playback: { labels: PATH_COUNTRIES, trails: true },
  animation: false,
  legend: { show: false },
  chrome: {
    title: "China's life expectancy is within half a year of America's on a sixth of the income",
    subtitle: `GDP per capita and life expectancy, ${FIRST_YEAR}-${LAST_YEAR}. Each line is one country's path, one dot per year.`,
  },
};

export const wealthHealthPaths = defineDemo({
  id: "blog/wealth-health-paths",
  title: `The paths of five countries through wealth and health, ${FIRST_YEAR}-${LAST_YEAR}`,
  source: wealthHealthSource,
  height: 520,
  phoneHeight: 560,
  spec: pathsSpec,
});

/** The years the small multiples show, one panel each. */
export const PANEL_YEARS = [1960, 1980, 2000, 2023];

const hasEveryValue = (row: (typeof wealthHealthRows)[number]) =>
  row.gdp !== null && row.life !== null && row.pop !== null;

const panelRows = wealthHealthRows.filter(
  (row) => PANEL_YEARS.includes(row.year) && hasEveryValue(row),
);

const populations = panelRows.map((row) => row.pop ?? 0);

export const wealthHealthPanels = defineDemo({
  id: "blog/wealth-health-small-multiples",
  title: `Wealth and health of 62 countries in ${PANEL_YEARS.join(", ")}`,
  source: wealthHealthSource,
  height: 880,
  spec: {
    mark: { type: "point", trendline: false },
    data: panelRows,
    encoding: {
      x: {
        ...wealthHealthEncoding.x,
        scale: { type: "log", domain: [10, 100000] },
        axis: { ...wealthHealthEncoding.x.axis, values: [100, 1000, 10000] },
      },
      y: {
        ...wealthHealthEncoding.y,
        scale: { domain: [30, 85] },
        axis: { title: "Life expectancy" },
      },
      // Explicit domains keep one size and color scale across the four panels.
      size: {
        ...wealthHealthEncoding.size,
        scale: { domain: [Math.min(...populations), Math.max(...populations)], range: [2, 16] },
      },
      color: wealthHealthEncoding.color,
      facet: { field: "year", type: "ordinal", columns: 1 },
    },
    chrome: {
      title: "Every country with 1960 and 2023 data got richer and longer-lived",
      subtitle:
        "GDP per capita and life expectancy for 62 countries in four years. Circle size is population.",
    },
  },
});
