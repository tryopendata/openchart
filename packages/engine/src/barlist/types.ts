/**
 * Internal normalized barlist spec type used by the compilation pipeline.
 */

import type {
  AnimationSpec,
  BarListEncoding,
  DarkMode,
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
  chrome: NormalizedChrome;
  theme: ThemeConfig;
  darkMode: DarkMode;
  watermark: boolean;
  animation?: AnimationSpec;
  valueFormat?: string;
}
