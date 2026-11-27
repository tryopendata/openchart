/**
 * The still the motion section shows before its playback chart loads: the same
 * chart with only its last period's rows and no playback, small enough to set
 * in the page as static SVG.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";

/** The playback spec's last period as a plain chart, for the build-time static SVG. */
export function playbackPosterSpec(_spec: ChartSpec): ChartSpec {
  throw new Error("playbackPosterSpec is not implemented.");
}
