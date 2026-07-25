import type {
  AnimationSpec,
  DarkMode,
  GeoMapEncoding,
  GeoMapGeo,
  GeoMapPointsLayer,
  LegendConfig,
  ThemeConfig,
} from '@opendata-ai/openchart-core';

import type { NormalizedChrome } from '../compiler/types';

export interface NormalizedGeoMapSpec {
  type: 'map';
  geo: Required<GeoMapGeo>;
  data: Record<string, unknown>[];
  encoding: GeoMapEncoding;
  chrome: NormalizedChrome;
  legend?: LegendConfig;
  theme: ThemeConfig;
  darkMode: DarkMode;
  watermark: boolean;
  animation?: AnimationSpec;
  valueFormat?: string;
  points?: GeoMapPointsLayer;
}
