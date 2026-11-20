/**
 * The hero's live chart: one `<Chart>` from the React package whose `spec` prop
 * changes with the step, so the library animates every change itself, including
 * the entrance the first time it mounts. HeroDesk loads this module with
 * `import()`, which keeps the library out of the page's up-front JavaScript.
 */

import type { ChartSpec } from "@opendata-ai/openchart-core";
import { Chart } from "@opendata-ai/openchart-react";
import { useEffect, useMemo } from "react";
import { chartTheme } from "../../../lib/demo/chart-theme";

export type HeroChartProps = {
  spec: ChartSpec;
  dark: boolean;
  /** Called once the chart's SVG is in the page, so the static SVG can step aside. */
  onMounted: () => void;
};

/** The live chart for the current step. */
export default function HeroChart({ spec, dark, onMounted }: HeroChartProps) {
  // A new theme object recreates the chart, so build it only when the page theme flips.
  const theme = useMemo(() => chartTheme(dark), [dark]);
  // The engine writes defaults into the spec it compiles, so the chart gets its own copy.
  // No attribution link inside the chart: this is the library's own site.
  const liveSpec = useMemo(() => ({ ...structuredClone(spec), watermark: false }), [spec]);
  // Child effects run first, so the chart has drawn by the time this one runs.
  useEffect(() => onMounted(), [onMounted]);
  return (
    <Chart
      spec={liveSpec}
      theme={theme}
      darkMode={dark ? "force" : "off"}
      className="hero-chart-live"
    />
  );
}
