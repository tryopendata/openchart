/**
 * Demos for the theming page (docs/style/theming): one chart of the US
 * electricity mix drawn with the library's default theme, with a custom
 * ThemeConfig, and with the accent-neutral series strategy. The first two set
 * `pageTheme: false` so the spec's own theme shows instead of the site's.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import type { ChartSpec, ThemeConfig } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const SHOWN_SOURCES = ["Coal", "Gas", "Nuclear"];

/** Coal, gas and nuclear shares by year, as the dataset gives them. */
const rows = electricityMixMatrix.data.filter((row) => SHOWN_SOURCES.includes(row.source));

/** One line per source; every figure on the page starts from this spec. */
const mixSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2.5, point: true },
  data: rows,
  encoding: {
    x: { field: "year", type: "temporal", axis: { format: "%Y", tickCount: 8 } },
    y: {
      field: "share",
      type: "quantitative",
      scale: { domain: [0, 50] },
      axis: { title: "Share of generation (%)", format: ".0f", grid: true },
    },
    color: { field: "source", type: "nominal", title: "Source" },
  },
  endpointLabels: { format: ".0f" },
  chrome: {
    title:
      "Coal's share of US electricity fell by almost half from 2016 to 2023 as gas rose to 44%",
    subtitle: "Share of generation from the six main sources, %, 2016–2023",
  },
};

export const defaultTheme = defineDemo({
  id: "style/theming-default",
  title: "US electricity mix in the default theme",
  source: sourceOf(electricityMixMatrix),
  height: 420,
  pageTheme: false,
  spec: mixSpec,
});

/** A house style: serif type, a paper background with a dark pair, three brand hues. */
const houseTheme: ThemeConfig = {
  colors: {
    categorical: [
      { light: "#8c2d19", dark: "#e07a5f" },
      { light: "#1f5c99", dark: "#7fb0e0" },
      { light: "#7a7267", dark: "#a8a095" },
    ],
    background: { light: "#f7f3ea", dark: "#1c1a17" },
    text: { light: "#24201a", dark: "#efe9dd" },
    gridline: { light: "rgba(36,32,26,0.1)", dark: "rgba(239,233,221,0.1)" },
    axis: { light: "#6e675c", dark: "#a69f92" },
  },
  fonts: {
    family: '"Source Serif 4", Georgia, serif',
    sizes: { title: 24, subtitle: 15 },
  },
  spacing: { padding: 28, chromeToChart: 20 },
  chrome: { title: { fontWeight: 600, lineHeight: 1.2 } },
  borderRadius: 0,
};

export const customTheme = defineDemo({
  id: "style/theming-custom",
  title: "US electricity mix in a custom theme",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  pageTheme: false,
  spec: { ...mixSpec, theme: houseTheme },
});

export const accentTheme = defineDemo({
  id: "style/theming-accent",
  title: "US electricity mix with one accent series",
  source: sourceOf(electricityMixMatrix),
  height: 420,
  spec: {
    ...mixSpec,
    theme: { seriesStrategy: "accent-neutral" },
    chrome: {
      title: "Coal fell from 31% to 16% of US electricity between 2016 and 2023",
      subtitle: "Share of generation from the six main sources, %, 2016–2023",
    },
  },
});
