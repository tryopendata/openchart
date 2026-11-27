/**
 * The still the motion section shows before its playback chart loads: the same
 * chart with only its last period's rows and no playback, small enough to set
 * in the page as static SVG.
 */
import type { ChartSpec, DataRow } from "@opendata-ai/openchart-core";
import {
  orderPeriods,
  type PlaybackPeriod,
  type PlaybackTimeType,
  readPeriod,
} from "@opendata-ai/openchart-engine";

function largestPeriod(periods: PlaybackPeriod[], type: PlaybackTimeType) {
  if (type === "ordinal") {
    return periods.reduce<PlaybackPeriod | undefined>(
      (largest, period) => (!largest || period.value > largest.value ? period : largest),
      undefined,
    );
  }
  orderPeriods(periods, { type });
  return periods.at(-1);
}

/** The playback spec's last period as a plain chart, for the build-time static SVG. */
export function playbackPosterSpec(spec: ChartSpec): ChartSpec {
  const encoding = { ...spec.encoding };
  if (!("time" in encoding) || !encoding.time) {
    throw new Error("The playback poster needs encoding.time.");
  }
  if (!spec.data.length) throw new Error("The playback poster has no rows.");

  const { field, type } = encoding.time;
  if (type !== "temporal" && type !== "quantitative" && type !== "ordinal") {
    throw new Error(`The playback poster cannot order ${type} periods.`);
  }

  const rowsByPeriod = new Map<string | number, DataRow[]>();
  const periods: PlaybackPeriod[] = [];
  for (const row of spec.data) {
    const period = readPeriod(row[field], type);
    if (!period) continue;
    const rows = rowsByPeriod.get(period.value);
    if (rows) {
      rows.push(row);
    } else {
      rowsByPeriod.set(period.value, [row]);
      periods.push(period);
    }
  }
  const last = largestPeriod(periods, type);
  if (!last) throw new Error(`The playback poster has no periods in ${field}.`);

  const { playback: _playback, ...chart } = spec;
  const poster = { ...chart, data: rowsByPeriod.get(last.value) ?? [] };
  delete encoding.time;
  poster.encoding = encoding;
  return poster;
}
