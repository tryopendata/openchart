/**
 * The publish section's island: the live chart at article width with its export
 * buttons and status line. It imports the published spec itself, so the spec is
 * not repeated in the page as a prop.
 *
 * Server render and before the library loads: the static SVGs (children) in the
 * chart's box and the export buttons disabled. The library loads lazily through
 * `useChartModule`, so it never weighs on the page's up-front JavaScript; if it
 * cannot load, the static chart stays, the buttons stay off and the status line
 * says why. An exported GIF covers the live chart in the same box, so the box
 * never changes height between static, live and GIF.
 */

import type { ChartHandle } from "@opendata-ai/openchart-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadChartLibrary, Mounted, useChartModule } from "../../shared/LiveChart";
import { usePageChartTheme } from "../../shared/page-theme";
import { ExportBar } from "./ExportBar";
import { GifActions } from "./GifActions";
import { publishSpec } from "./publish-spec";
import { useChartExport } from "./use-chart-export";

export type PublishDeskProps = {
  /** The chart's generated alt text, from the build; the GIF's alt text starts from it. */
  altText: string;
  /** The static SVGs of the published chart, in both themes. */
  children?: ReactNode;
};

/**
 * True once the chart library has failed to load. It shares `useChartModule`'s
 * request (which logs the failure), so this only listens for the outcome.
 */
function useLibraryFailed(): boolean {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadChartLibrary().catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return failed;
}

/** The published chart and its exports. */
export function PublishDesk({ altText, children }: PublishDeskProps) {
  const module = useChartModule();
  const libraryFailed = useLibraryFailed();
  const { theme, darkMode } = usePageChartTheme();
  const handle = useRef<ChartHandle>(null);
  const gifButton = useRef<HTMLButtonElement>(null);
  const [live, setLive] = useState(false);
  const getChart = useCallback(() => handle.current?.instance ?? null, []);
  const markLive = useCallback(() => setLive(true), []);
  const { state, gif, run, closeGif } = useChartExport(getChart);
  // The engine writes defaults into the spec it compiles, so the chart gets its own copy.
  // No attribution link inside the chart: this is the library's own site.
  const liveSpec = useMemo(() => ({ ...structuredClone(publishSpec), watermark: false }), []);

  const backToChart = useCallback(() => {
    closeGif();
    // The Back button leaves with the GIF; focus goes to the button that made it.
    gifButton.current?.focus();
  }, [closeGif]);

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
          <img
            data-publish-gif
            className="publish-gif"
            src={gif.url}
            alt={`Animated GIF export: ${altText}`}
          />
        ) : null}
      </div>
      <ExportBar
        ready={live}
        libraryFailed={libraryFailed}
        state={state}
        onExport={run}
        gifButtonRef={gifButton}
      >
        <GifActions gif={gif} busy={state.kind === "working"} onClose={backToChart} />
      </ExportBar>
    </div>
  );
}
