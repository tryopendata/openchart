/**
 * The publish section's island: the live chart at article width with its export
 * buttons and status line. It imports the published spec itself, so the spec is
 * not repeated in the page as a prop.
 *
 * Server render and before the library loads: the static SVGs (children) in the
 * chart's box and the export buttons disabled. The library is imported lazily
 * through `loadChartLibrary`, so it never weighs on the page's up-front
 * JavaScript; if it cannot load, the static chart stays and the buttons stay off.
 * An exported GIF covers the live chart in the same box, so the box never
 * changes height between static, live and GIF.
 */

import type { ChartHandle } from "@opendata-ai/openchart-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ChartModule, loadChartLibrary, Mounted } from "../../shared/LiveChart";
import { usePageChartTheme } from "../../shared/page-theme";
import { ExportBar } from "./ExportBar";
import { GifActions } from "./GifActions";
import { publishSpec } from "./publish-spec";
import { useChartExport } from "./use-chart-export";

export type PublishDeskProps = {
  /** The static SVGs of the published chart, in both themes. */
  children?: ReactNode;
};

/** The chart's headline, the GIF's alt text. */
const CHART_TITLE = (() => {
  const title = publishSpec.chrome?.title;
  return typeof title === "string" ? title : (title?.text ?? "The published chart");
})();

/** The chart library once loaded, or null while loading or after a failed load. */
function usePublishChartModule(): ChartModule | null {
  const [module, setModule] = useState<ChartModule | null>(null);
  useEffect(() => {
    let active = true;
    loadChartLibrary().then(
      (loaded) => {
        if (active) setModule(loaded);
      },
      (error: unknown) => {
        console.error(
          "Publish section: the chart library did not load; showing the static chart.",
          error,
        );
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return module;
}

/** The published chart and its exports. */
export function PublishDesk({ children }: PublishDeskProps) {
  const module = usePublishChartModule();
  const { theme, darkMode } = usePageChartTheme();
  const handle = useRef<ChartHandle>(null);
  const [live, setLive] = useState(false);
  const getChart = useCallback(() => handle.current?.instance ?? null, []);
  const markLive = useCallback(() => setLive(true), []);
  const { state, gif, run, closeGif } = useChartExport(getChart);
  // The engine writes defaults into the spec it compiles, so the chart gets its own copy.
  // No attribution link inside the chart: this is the library's own site.
  const liveSpec = useMemo(() => ({ ...structuredClone(publishSpec), watermark: false }), []);

  return (
    <div className="publish-desk">
      <div className="publish-stage" data-publish-chart data-showing-gif={gif ? "" : undefined}>
        {module ? (
          <>
            <module.Chart
              ref={handle}
              spec={liveSpec}
              theme={theme}
              darkMode={darkMode}
              className="publish-live"
            />
            <Mounted onMounted={markLive} />
          </>
        ) : (
          children
        )}
        {gif ? (
          <img data-publish-gif className="publish-gif" src={gif.url} alt={CHART_TITLE} />
        ) : null}
      </div>
      <ExportBar ready={live} state={state} onExport={run}>
        {gif ? <GifActions gif={gif} onClose={closeGif} /> : null}
      </ExportBar>
    </div>
  );
}
