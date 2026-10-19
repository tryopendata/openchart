import type {
  AnimationSpec,
  FieldMetadata,
  GeoCallout,
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
  // Projection stays optional until topology inference. Zoom remains runtime
  // interaction; compilation reads only its portable control obstacle.
  geo: Required<Omit<GeoMapGeo, 'projection' | 'zoom'>> & {
    projection?: GeoMapProjection;
    zoom?: GeoMapGeo['zoom'];
  };
  data: Record<string, unknown>[];
  encoding: GeoMapEncoding;
  chrome: NormalizedChrome;
  legend?: LegendConfig;
  theme: ThemeConfig;
  watermark: boolean;
  animation?: AnimationSpec;
  points?: GeoMapPointsLayer;
  fields?: Record<string, FieldMetadata>;
  callouts?: GeoCallout[];
}
