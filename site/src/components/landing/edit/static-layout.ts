/**
 * The sizes the edit section's chart is drawn at for the server HTML, one per
 * stage width range, and where the plot starts in each.
 *
 * The static SVG scales into the stage keeping its aspect, so it only lines up
 * with the spec column beside it when it is drawn close to the stage's real
 * width. Each size is the narrowest stage in its range (landing-edit.css shows
 * one set per range), so the drawing never shrinks there and its plot starts
 * exactly `plotTop` from the top. The spec column uses that as its offset until
 * the live chart reports its own.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { compileChart } from "@opendata-ai/openchart-engine";
import { chartTheme } from "../../../lib/demo/chart-theme";

/** Which stage width range a static drawing is for; demo.css matches `data-static-size` on these. */
export type StaticSize = "phone" | "tablet" | "lg" | "xl";

/** The size one static drawing is laid out at. */
export type StaticLayout = { width: number; height: number };

/**
 * Per range, with the stage widths the landing container's padding and the
 * eight-of-twelve column from 1024px give: under 640px 280 to 599 (drawn at a
 * phone's 360, the height the phone stage has), 640 to 1023 592 to 976 (the
 * readout sits under the chart there, so the plot's top matters less), 1024 to
 * 1279 629 to 800, and from 1280 800 to 907. A classic scrollbar (15px on
 * Linux, 17px on Windows) narrows the stage by two thirds of its width, to 617
 * at 1024, so the `lg` drawing is 616 wide and never shrinks.
 */
export const STATIC_LAYOUTS: Readonly<Record<StaticSize, StaticLayout>> = {
  phone: { width: 360, height: 440 },
  tablet: { width: 880, height: 480 },
  lg: { width: 616, height: 480 },
  xl: { width: 800, height: 480 },
};

/** Where the plot starts, in px from the chart's top, when `spec` is laid out at `layout`'s size. */
export function staticPlotTop(spec: ChartSpec, layout: StaticLayout): number {
  // The engine writes defaults into the spec it compiles, so it gets a copy; no watermark, as on the page.
  const compiled = compileChart(
    { ...structuredClone(spec), watermark: false },
    { width: layout.width, height: layout.height, theme: chartTheme(false) },
  );
  return compiled.area.y;
}
