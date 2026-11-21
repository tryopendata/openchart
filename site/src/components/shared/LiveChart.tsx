/**
 * The one live chart for React islands. It shows the build-time static SVGs
 * (passed as children) until the chart library has loaded, then the library's
 * `<Chart>` in the page's theme, so the library plays its own entrance and
 * animates every later change to `spec`. The library is imported lazily: the
 * page's up-front JavaScript never carries it, and readers without JavaScript
 * keep the static chart. Islands use this instead of importing `<Chart>`.
 */
import type { ChartSpec, DarkMode, LayerSpec, ThemeConfig } from "@opendata-ai/openchart-core";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePageChartTheme } from "./page-theme";

type ChartModule = typeof import("@opendata-ai/openchart-react");

let loading: Promise<ChartModule> | undefined;

/** Starts fetching the chart library; every caller shares one request. Call it early to warm the chunk. */
export function loadChartLibrary(): Promise<ChartModule> {
  loading ??= import("@opendata-ai/openchart-react").catch((error: unknown) => {
    // Let a later caller try again rather than inherit a failed load.
    loading = undefined;
    throw error;
  });
  return loading;
}

function useChartModule(): ChartModule | null {
  const [module, setModule] = useState<ChartModule | null>(null);
  useEffect(() => {
    let active = true;
    loadChartLibrary().then(
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

/** Tells the parent the live chart is in the page. Child effects run first, so the chart has drawn. */
function Mounted({ onMounted }: { onMounted: () => void }) {
  useEffect(() => onMounted(), [onMounted]);
  return null;
}

export type LiveChartProps = {
  /** Changing it animates through the library's own transition. */
  spec: ChartSpec | LayerSpec;
  /** Changing it re-creates the chart, which replays its entrance. */
  mountKey?: number | string;
  className?: string;
  /** Called once the live chart has replaced the static one. Keep its identity stable. */
  onMounted?: () => void;
  /** The static SVGs shown until the live chart is ready. */
  children?: ReactNode;
  /**
   * Replaces the page theme for a chart that carries its own house style in
   * `spec.theme`. A mount theme overrides the spec's theme, so to keep a spec's
   * own theme pass `theme: undefined` with the dark mode you want, for example
   * `{ theme: undefined, darkMode: "off" }`. Keep the object's identity stable
   * between renders: a new theme object re-creates the chart.
   */
  themeOverride?: { theme: ThemeConfig | undefined; darkMode: DarkMode };
};

/** The live chart, or its static stand-in while the library loads. */
export function LiveChart({
  spec,
  mountKey = 0,
  className,
  onMounted,
  children,
  themeOverride,
}: LiveChartProps) {
  const module = useChartModule();
  const page = usePageChartTheme();
  const { theme, darkMode } = themeOverride ?? page;
  // The engine writes defaults into the spec it compiles, so the chart gets its own copy.
  // No attribution link inside the chart: this is the library's own site.
  const liveSpec = useMemo(() => ({ ...structuredClone(spec), watermark: false }), [spec]);
  if (!module) return <div className={className}>{children}</div>;
  return (
    <>
      <module.Chart
        key={mountKey}
        spec={liveSpec}
        theme={theme}
        darkMode={darkMode}
        className={className}
      />
      {onMounted ? <Mounted onMounted={onMounted} /> : null}
    </>
  );
}
