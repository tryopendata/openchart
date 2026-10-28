import type { DataRow, EncodingChannel } from '@opendata-ai/openchart-core';
import { type ScaleTime, scaleBand } from 'd3-scale';
import type { ResolvedScale } from '../../layout/scales';
import { resolveTemporalInterval, temporalDate } from '../../layout/temporal-interval';
import { groupByField } from '../utils';

/** Reuse categorical stacking/grouping inside each continuous temporal slot. */
export function temporalBands(position: ResolvedScale, channel: EncodingChannel, data: DataRow[]) {
  const scale = position.scale as ScaleTime<number, number>;
  const interval =
    position.temporalInterval ??
    resolveTemporalInterval(channel, data, position.type as 'utc' | 'time');
  const padding = channel.scale?.padding ?? 0.2;
  return [...groupByField(data, channel.field)].flatMap(([category, rows]) => {
    const date = temporalDate(rows[0][channel.field]);
    const center = scale(date);
    const width = Math.abs(scale(interval.offset(date)) - center) * (1 - padding);
    if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) return [];
    const band = scaleBand<string>()
      .domain([category])
      .range([center - width / 2, center + width / 2]);
    return [{ data: rows, position: { ...position, type: 'band' as const, scale: band } }];
  });
}

/** Shared membership is resolved once, so sparse dates keep their group slots. */
export interface TemporalGrouping {
  multipleRows: boolean;
  order: string[];
}
export function temporalGrouping(
  data: DataRow[],
  categoryField: string,
  colorField?: string,
): TemporalGrouping {
  return {
    multipleRows: [...groupByField(data, categoryField).values()].some((rows) => rows.length > 1),
    order: colorField ? [...new Set(data.map((row) => String(row[colorField] ?? '')))] : [],
  };
}
