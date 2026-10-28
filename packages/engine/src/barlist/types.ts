/**
 * Internal normalized barlist spec type used by the compilation pipeline.
 */

import type {
  AnimationSpec,
  BarListEncoding,
  BarListSpec,
  DataRow,
  ThemeConfig,
} from '@opendata-ai/openchart-core';

import type { NormalizedChrome } from '../compiler/types';

export interface NormalizedBarListSpec {
  type: 'barlist';
  data: DataRow[];
  encoding: BarListEncoding;
  barHeight: number;
  cornerRadius: number | 'pill';
  maxItems: number;
  sort: 'descending' | 'ascending' | null;
  height?: BarListSpec['height'];
  annotations?: BarListSpec['annotations'];
  labels?: BarListSpec['labels'];
  a11y?: BarListSpec['a11y'];
  chrome: NormalizedChrome;
  theme: ThemeConfig;
  watermark: boolean;
  animation?: AnimationSpec;
}
