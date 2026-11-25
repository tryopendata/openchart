/**
 * A hand-built `ChartPlayback` for the vanilla playback tests, so the frame writer, tooltip
 * and session can be tested without the engine's playback compile. The base layout is a
 * real compile of three keyed points; frames move each point right by 10px per period.
 */
import type { ChartLayout, ChartSpec, PointMark } from '@opendata-ai/openchart-core';
import {
  type ChartPlayback,
  compileChart,
  type FrameMark,
  type FrozenChartFrame,
  type ObservedValues,
  resolvePlayback,
} from '@opendata-ai/openchart-engine';

export const KEYS = ['Avalon', 'Borea', 'Cydonia'];
export const PERIOD_LABELS = ['2000', '2001', '2002'];

const baseSpec: ChartSpec = {
  mark: { type: 'point', trendline: false },
  animation: false,
  data: KEYS.map((country, index) => ({ country, gdp: 100 * (index + 1), life: 50 + index })),
  encoding: {
    x: { field: 'gdp', type: 'quantitative', title: 'GDP per capita' },
    y: { field: 'life', type: 'quantitative' },
    key: { field: 'country', type: 'nominal' },
  },
};

export interface FakePlaybackOptions {
  /** Observed values by key, or null for a key with none near t. */
  observed?: (key: string, t: number) => ObservedValues | null;
  /** Presence per key at t. Defaults to 1. */
  presence?: (key: string, t: number) => number;
  /** Extra frame entries with no element in the base SVG. */
  extraKeys?: string[];
  periodCount?: number;
  timing?: Parameters<typeof resolvePlayback>[0];
}

/** The base layout the fake playback's SVG is rendered from. */
export function fakeBaseLayout(): ChartLayout {
  return compileChart(baseSpec, { width: 600, height: 400, onWarn: () => {} });
}

/** Where the fake draws `key` at `t`: its base position moved 10px right per period. */
export function fakeCx(base: ChartLayout, key: string, t: number): number {
  const mark = base.marks.find((m): m is PointMark => m.type === 'point' && m.key === key);
  if (!mark) throw new Error(`no base mark for ${key}`);
  return mark.cx + 10 * t;
}

export function createFakePlayback(options: FakePlaybackOptions = {}): ChartPlayback {
  const base = fakeBaseLayout();
  const periodCount = options.periodCount ?? 3;
  const periods = Array.from({ length: periodCount }, (_, index) => ({
    value: 2000 + index,
    sortKey: 2000 + index,
  }));
  const basePoints = base.marks.filter((mark): mark is PointMark => mark.type === 'point');
  const clamp = (t: number) => Math.max(0, Math.min(periodCount - 1, t));
  const marksAt = (t: number): FrameMark[] => {
    const at = clamp(t);
    const frame: FrameMark[] = basePoints.map((mark) => ({
      key: String(mark.key),
      mark: { ...mark, cx: mark.cx + 10 * at, cy: mark.cy - 5 * at, r: mark.r + at },
      presence: options.presence?.(String(mark.key), at) ?? 1,
    }));
    for (const key of options.extraKeys ?? []) {
      frame.push({ key, mark: { ...basePoints[0], key, cx: 1, cy: 1 }, presence: 1 });
    }
    return frame;
  };
  return {
    frame: {
      layout: { ...base, marks: [] },
      spec: { encoding: baseSpec.encoding },
      formatters: {},
      pointOpacity: 0.85,
    } as unknown as FrozenChartFrame,
    base,
    periods,
    periodLabels: PERIOD_LABELS.slice(0, periodCount),
    timing: resolvePlayback(options.timing, periodCount),
    keys: basePoints.map((mark) => String(mark.key)),
    warnings: [],
    marksAt,
    overlaysAt: () => [],
    trailsAt: () => [],
    observedAt: (key, t) => options.observed?.(key, clamp(t)) ?? null,
    describe: (t) => PERIOD_LABELS[Math.round(clamp(t))] ?? '',
  };
}
