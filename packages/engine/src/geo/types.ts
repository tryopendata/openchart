import type {
  AnimationSpec,
  DarkMode,
  LegendConfig,
  MapEncoding,
  MapGeo,
  ThemeConfig,
} from '@opendata-ai/openchart-core';

import type { NormalizedChrome } from '../compiler/types';

export interface NormalizedMapSpec {
  type: 'map';
  geo: Required<MapGeo>;
  data: Record<string, unknown>[];
  encoding: MapEncoding;
  chrome: NormalizedChrome;
  legend?: LegendConfig;
  theme: ThemeConfig;
  darkMode: DarkMode;
  watermark: boolean;
  animation?: AnimationSpec;
  valueFormat?: string;
}
