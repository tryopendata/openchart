/**
 * The motion section's playback chart. The island shows the build-time poster
 * (children) until it has imported the playback demo's spec and rows, which are
 * kept out of the page's HTML, then plays the chart with the library's own
 * playback controls.
 */
import type { ReactNode } from "react";

export type PlaybackFigureProps = {
  /** The poster: static SVGs of the last period, in both themes. */
  children?: ReactNode;
};

/** The playback chart, loaded when the motion section is seen. */
export function PlaybackFigure({ children }: PlaybackFigureProps) {
  return <div data-playback-figure>{children}</div>;
}
