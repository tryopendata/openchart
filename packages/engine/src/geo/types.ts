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
  // compileGeoMap, not filled in by normalize. `zoom` is reader interaction,
  // read by the vanilla mount from the spec; the compiler never sees it.
  geo: Required<Omit<GeoMapGeo, 'projection' | 'zoom'>> & { projection?: GeoMapProjection };
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
