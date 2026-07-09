/**
 * Internal normalized tilemap spec type used by the compilation pipeline.
 *
 * This mirrors NormalizedSankeySpec: all optional fields have been filled
 * with sensible defaults. It's an engine implementation detail, not a public contract.
 */

import type {
  AnimationSpec,
  DarkMode,
  LegendConfig,
  ThemeConfig,
  TileMapEncoding,
  TileMapPalette,
} from '@opendata-ai/openchart-core';

import type { NormalizedChrome } from '../compiler/types';

/** A TileMapSpec with all optional fields filled with defaults. */
export interface NormalizedTileMapSpec {
  type: 'tilemap';
  data: Record<string, unknown>[];
  encoding: TileMapEncoding;
  palette: TileMapPalette;
  colors?: Record<string, string>;
  chrome: NormalizedChrome;
  legend?: LegendConfig;
  theme: ThemeConfig;
  darkMode: DarkMode;
  watermark: boolean;
  animation?: AnimationSpec;
  valueFormat?: string;
}
