/**
 * The motion section's playback chart. The island shows the build-time poster
 * (children) until it has imported the playback demo's spec and rows, which are
 * kept out of the page's HTML, then plays the chart with the library's own
 * playback controls. If either fails to load, the still stays and a line under
 * it says so (StillNote; the same line shows without JavaScript).
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { type ReactNode, useEffect, useState } from "react";
import { LiveChart, loadChartLibrary } from "../../shared/LiveChart";
import { StillNote } from "../../shared/StillNote";

/** The build-time still the figure shows while playback loads. */
export type PlaybackFigureProps = {
  /** The still: static SVGs of the last period, in both themes. */
  children?: ReactNode;
};

/** The playback chart, loaded when the motion section is seen. */
export function PlaybackFigure({ children }: PlaybackFigureProps) {
  const [spec, setSpec] = useState<ChartSpec | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    // The rows and the library are separate chunks; fetch them together.
    Promise.all([import("../../../demos/landing/playback"), loadChartLibrary()])
      .then(([{ landingPlaybackSpec }]) => {
        if (active) setSpec(landingPlaybackSpec);
      })
      .catch((error: unknown) => {
        if (active) {
          console.error(
            "The motion section's playback chart could not be loaded; showing the still.",
            error,
          );
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div data-playback-figure>
        {spec ? (
          <LiveChart spec={spec} className="h-full">
            {children}
          </LiveChart>
        ) : (
          children
        )}
      </div>
      <StillNote failed={failed} />
    </>
  );
}
