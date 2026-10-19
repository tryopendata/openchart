import type {
  CategoricalLegendLayout,
  ContinuousLegendLayout,
  EncodingChannel,
  GeoColorKeyLayout,
} from '@opendata-ai/openchart-core';
import { finiteNumber } from '../data/finite-number';
import type { ClassScale } from '../legend/continuous';
export function geoColorKeyReserve(
  config: { activeValue?: boolean; distribution?: boolean } | undefined,
  fontSize: number,
  activeLines = 1,
): number {
  if (!config?.activeValue && !config?.distribution) return 0;
  const line = Math.ceil(fontSize * 1.4);
  return (
    (config.activeValue ? line * activeLines * 2 + 8 : 0) +
    (config.distribution ? line * 3 + 32 : 0)
  );
}
export function buildGeoColorKey(
  config: { activeValue?: boolean; distribution?: boolean } | undefined,
  channel: EncodingChannel | undefined,
  key: ContinuousLegendLayout | CategoricalLegendLayout | null,
  rows: Array<Record<string, unknown> | null>,
  classScale: ClassScale | undefined,
  fontSize: number,
  reserve: number,
  activePlan?: { lines: number; labels: Record<string, string[]> },
): GeoColorKeyLayout | undefined {
  if (!key || !channel || !reserve) return undefined;
  const line = Math.ceil(fontSize * 1.4);
  const activeRowHeight = line * (activePlan?.lines ?? 1);
  const activeHeight = config?.activeValue ? activeRowHeight * 2 + 8 : 0;
  const y = key.bounds.y + key.bounds.height - reserve;
  const activeRows = config?.activeValue
    ? [0, 1].map((index) => ({
        x: key.bounds.x,
        y: y + index * activeRowHeight,
        width: key.bounds.width,
        height: activeRowHeight,
      }))
    : [];
  const values = rows.map((row) => row?.[channel.field]);
  let missing = 0;
  const classes: GeoColorKeyLayout['classes'] = [];
  const categories: GeoColorKeyLayout['categories'] = [];
  let kind: GeoColorKeyLayout['kind'] = 'categorical';
  let domain: [number, number] | undefined;
  if (key.type === 'continuous') {
    kind = key.mode;
    if (key.mode === 'binned' && classScale) {
      for (const [index, bin] of key.bins.entries())
        classes.push({
          index,
          color: bin.color,
          ...(index ? { lower: classScale.breaks[index - 1] } : {}),
          ...(index < classScale.breaks.length ? { upper: classScale.breaks[index] } : {}),
          count: 0,
          x: key.rangeEntries?.[index]?.bounds.x ?? bin.x,
          width: key.rangeEntries?.[index]?.bounds.width ?? bin.width,
          ...(key.rangeEntries?.[index]
            ? { y: key.rangeEntries[index].bounds.y, height: key.rangeEntries[index].bounds.height }
            : {}),
        });
      for (const value of values) {
        const number = finiteNumber(value);
        if (number === undefined) missing++;
        else {
          const bin = classes[classScale.binIndex(number)];
          if (bin) bin.count++;
        }
      }
    } else {
      const first = key.ticks[0]?.value;
      const last = key.ticks.at(-1)?.value;
      if (first !== undefined && last !== undefined) domain = [first, last];
      missing = values.filter((value) => finiteNumber(value) === undefined).length;
    }
  } else {
    for (const [index, entry] of key.entries.entries()) {
      const position = key.entryPositions?.[index];
      categories.push({
        value: entry.label,
        color: entry.color,
        count: 0,
        bounds: position
          ? { x: position.x, y: position.y, width: position.width, height: key.rowHeight ?? 22 }
          : { ...key.bounds },
      });
    }
    for (const value of values) {
      if (value == null) missing++;
      else {
        const entry = categories.find((entry) => entry.value === String(value));
        if (entry) entry.count++;
        else missing++;
      }
    }
  }
  const authored = channel.scale?.domain;
  const clampDomain =
    channel.scale?.type !== 'threshold' &&
    channel.scale?.type !== 'quantile' &&
    Array.isArray(authored) &&
    authored.length === 2 &&
    authored.every((value) => typeof value === 'number' && Number.isFinite(value))
      ? (authored as [number, number])
      : undefined;
  return {
    kind,
    field: channel.field,
    format: channel.format,
    activeValue: !!config?.activeValue,
    distribution: !!config?.distribution,
    classes,
    categories,
    missing,
    ...(key.type === 'continuous' ? { bar: { ...key.bar } } : {}),
    ...(domain ? { domain } : {}),
    ...(clampDomain ? { clampDomain } : {}),
    activeRows,
    ...(activePlan ? { activeLabels: activePlan.labels } : {}),
    ...(config?.distribution
      ? {
          distributionBounds: {
            x: key.bounds.x,
            y: y + activeHeight,
            width: key.bounds.width,
            height: reserve - activeHeight,
          },
        }
      : {}),
  };
}
/** Marker coordinates use the actual key mapping: discrete classes or raw gradient position. */
export function geoColorKeyPosition(
  key: GeoColorKeyLayout,
  value: unknown,
): { x?: number; y?: number; category?: string; outside: boolean; missing: boolean } {
  if (key.kind === 'categorical')
    return {
      category: value == null ? undefined : String(value),
      outside: false,
      missing: value == null,
    };
  const number = finiteNumber(value);
  if (number === undefined) return { outside: false, missing: true };
  const outside = !!key.clampDomain && (number < key.clampDomain[0] || number > key.clampDomain[1]);
  if (outside && key.classes.some((bin) => bin.y !== undefined)) {
    const bin = number < key.clampDomain![0] ? key.classes[0] : key.classes.at(-1)!;
    return {
      x: bin.x + bin.width / 2,
      y: bin.y! + (bin.height ?? 0) / 2,
      outside: true,
      missing: false,
    };
  }
  if (outside && key.bar)
    return {
      x: number < key.clampDomain![0] ? key.bar.x : key.bar.x + key.bar.width,
      outside: true,
      missing: false,
    };
  if (key.kind === 'binned') {
    const bin = key.classes.find(
      (bin) =>
        (bin.lower === undefined || number >= bin.lower) &&
        (bin.upper === undefined || number < bin.upper),
    );
    return {
      x: bin ? bin.x + bin.width / 2 : undefined,
      ...(bin?.y === undefined ? {} : { y: bin.y + (bin.height ?? 0) / 2 }),
      outside: false,
      missing: false,
    };
  }
  const [lo, hi] = key.domain ?? [0, 0];
  return {
    x: key.bar
      ? key.bar.x +
        (hi === lo ? 0.5 : Math.max(0, Math.min(1, (number - lo) / (hi - lo)))) * key.bar.width
      : undefined,
    outside: false,
    missing: false,
  };
}
