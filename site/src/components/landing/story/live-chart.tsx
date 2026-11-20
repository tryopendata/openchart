/**
 * A chart that shows its build-time static SVG (passed as children) until the
 * chart library has loaded, then the live `<Chart>`. The library is imported
 * lazily, so the landing page's up-front JavaScript stays small and readers
 * without JavaScript keep the static chart. Used by the motion and responsive
 * islands; the scroll story mounts through the vanilla story API instead.
 */
import type { ChartSpec, LayerSpec } from "@opendata-ai/openchart-core";
import { type ReactNode, useEffect, useState } from "react";
import { usePageChartTheme } from "./page-theme";

type ChartModule = typeof import("@opendata-ai/openchart-react");

/** Loads the React chart package once the island has hydrated; null until then. */
function useChartModule(): ChartModule | null {
  const [module, setModule] = useState<ChartModule | null>(null);
  useEffect(() => {
    let active = true;
    import("@opendata-ai/openchart-react").then(
      (loaded) => {
        if (active) setModule(loaded);
      },
      (error: unknown) => {
        // The static chart stays in place; the reader loses only the live one.
        console.error("The chart library could not be loaded; showing the static chart.", error);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return module;
}

export type LiveChartProps = {
  spec: ChartSpec | LayerSpec;
  /** Changing it re-creates the chart, which replays its entrance. */
  mountKey?: number;
  className?: string;
  /** The static SVGs shown until the live chart is ready. */
  children?: ReactNode;
};

/** The live chart, or its static stand-in while the library loads. */
export function LiveChart({ spec, mountKey = 0, className, children }: LiveChartProps) {
  const module = useChartModule();
  const { theme, darkMode } = usePageChartTheme();
  // The sized wrapper stays put and the chart fills it, so the library sees a
  // constrained height and never grows the figure with its chrome.
  return (
    <div className={className}>
      {module ? (
        <module.Chart
          key={mountKey}
          spec={{ ...spec, watermark: false }}
          theme={theme}
          darkMode={darkMode}
          className="live-chart"
        />
      ) : (
        children
      )}
    </div>
  );
}
