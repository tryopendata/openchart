/**
 * The agent session's chart drawn live with `@opendata-ai/openchart-react`, so
 * it plays the library's own entrance when the session reaches it. The library
 * is imported lazily: the page's up-front bundle never carries it, and until it
 * arrives the server-rendered static SVG (`fallback`) stays in place.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { lazy, type ReactNode, Suspense } from "react";
import { chartTheme } from "../../../lib/demo/chart-theme";
import { usePageDark } from "./use-page-dark";

/** Starts fetching the chart library. Calling it again reuses the same request. */
export const loadChartLibrary = () => import("@opendata-ai/openchart-react");

const Chart = lazy(() => loadChartLibrary().then((module) => ({ default: module.Chart })));

type LiveChartProps = {
  spec: ChartSpec;
  /** Shown while the library loads: the static SVG the server rendered. */
  fallback: ReactNode;
};

/** The spec as a live chart in the page's theme, with the attribution link left off (this is the library's own site). */
export function LiveChart({ spec, fallback }: LiveChartProps) {
  const dark = usePageDark();
  return (
    <Suspense fallback={fallback}>
      <Chart
        className="agent-chart-live"
        spec={{ ...spec, watermark: false }}
        theme={chartTheme(dark)}
        darkMode={dark ? "force" : "off"}
      />
    </Suspense>
  );
}
