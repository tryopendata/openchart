import type {
  AnimationSpec,
  DarkMode,
  GeoMapEncoding,
  GeoMapGeo,
  GeoMapPointsLayer,
  GeoMapProjection,
  LegendConfig,
  ThemeConfig,
} from '@opendata-ai/openchart-core';

import type { NormalizedChrome } from '../compiler/types';

export interface NormalizedGeoMapSpec {
  type: 'map';
  // `projection` stays optional: it is resolved from the topology in
  // compileGeoMap, not filled in by normalize.
  geo: Required<Omit<GeoMapGeo, 'projection'>> & { projection?: GeoMapProjection };
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
