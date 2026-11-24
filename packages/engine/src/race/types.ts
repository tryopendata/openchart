import type {
  EncodingChannel,
  RaceEncoding,
  RaceMarkDef,
  RacePlayback,
  RaceSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import type { NormalizedChrome } from '../compiler/types';

export interface NormalizedRaceSpec
  extends Omit<RaceSpec, 'mark' | 'encoding' | 'race' | 'chrome' | 'theme' | 'watermark'> {
  mark: RaceMarkDef;
  encoding: RaceEncoding & {
    time: EncodingChannel;
    key: EncodingChannel;
    value: EncodingChannel;
  };
  race: ResolvedRaceOptions;
  chrome: NormalizedChrome;
  theme: ThemeConfig;
  watermark: boolean;
}

export interface ResolvedRaceOptions {
  top: number;
  duration?: number;
  step?: number;
  swap: number;
  rescale: 'frame' | 'fixed' | { min: number };
  gaps: 'interpolate' | 'hold' | 'drop';
  holdEnd: number;
  loop: boolean;
  autoplay: 'visible' | boolean;
  controls: boolean;
  period: false | { format?: string };
  summary: 'sum' | false;
}

export interface RaceMatrix {
  /** Sorted ascending. Dates become ISO strings. */
  periods: Array<{ value: string | number; sortKey: number }>;
  /** Sorted by localeCompare with locale 'en'. Index order is the final tie-break. */
  keys: string[];
  /** Last non-null label value per key, or the key itself. */
  labels: string[];
  /** Last non-null color field value per key. Null when color is not a field. */
  colorValues: Array<string | null>;
  /** One array per key, with one value per period. NaN represents absence. */
  values: Float64Array[];
}

export interface RaceTimelineOptions {
  top: number;
  swapPeriods: number;
  samplesPerPeriod: number;
  rescale: ResolvedRaceOptions['rescale'];
}

export interface RaceSampleItem {
  keyIndex: number;
  value: number;
  rank: number;
  rankPos: number;
  opacity: number;
  change: number;
}

export interface RaceSample {
  t: number;
  periodIndex: number;
  items: RaceSampleItem[];
  domainMin: number;
  domainMax: number;
}

export interface RaceTimeline {
  readonly periodCount: number;
  readonly keyCount: number;
  readonly top: number;
  /** Number of rank samples per period interval. */
  readonly samplesPerPeriod: number;
  /** NaN when absent. */
  valueAt(keyIndex: number, t: number): number;
  /** Smoothed rank in [0, top]. */
  rankPos(keyIndex: number, t: number): number;
  /** Zero-based rank among present keys. Infinity when absent. */
  exactRank(keyIndex: number, t: number): number;
  /** Cached exact rank at an integer period index. Infinity when absent. */
  periodRank(keyIndex: number, period: number): number;
  /** Exact and smoothed ranks on the sample grid. A missing exact rank equals keyCount. */
  rankSamples(keyIndex: number): {
    exact: Readonly<Float32Array>;
    smoothed: Readonly<Float32Array>;
  };
  /** Items with rankPos < top, sorted by rankPos. */
  sample(t: number): RaceSample;
}

export interface RaceColorAssignment {
  slotsFor(paletteSize: number): readonly (number | string)[];
  /** Assignments already used by a spec or layout, available to carry across updates. */
  readonly byPaletteSize: ReadonlyMap<number, readonly (number | string)[]>;
}

export interface RaceModel {
  spec: NormalizedRaceSpec;
  /** Authored watermark setting, before normalization supplies a default. */
  specWatermark?: boolean;
  matrix: RaceMatrix;
  timeline: RaceTimeline;
  colorAssignment: RaceColorAssignment;
  /** Spec-theme light colors for standalone frames. On-screen geometry uses layout.colors. */
  frameColors: string[];
  periodLabels: string[];
  formatValue: (value: number) => string;
  playback: RacePlayback;
  warnings: string[];
}
