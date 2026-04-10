/**
 * Internal normalized sankey spec type used by the compilation pipeline.
 *
 * This mirrors NormalizedChartSpec/NormalizedGraphSpec: all optional fields
 * have been filled with sensible defaults. It's an engine implementation
 * detail, not a public contract.
 */

import type {
  AnimationSpec,
  DarkMode,
  LegendConfig,
  SankeyEncoding,
  SankeyLinkColor,
  SankeyNodeAlign,
  ThemeConfig,
} from '@opendata-ai/openchart-core';

import type { NormalizedChrome } from '../compiler/types';

/** A SankeySpec with all optional fields filled with defaults. */
export interface NormalizedSankeySpec {
  type: 'sankey';
  data: Record<string, unknown>[];
  encoding: SankeyEncoding;
  nodeWidth: number;
  nodePadding: number;
  nodeAlign: SankeyNodeAlign;
  iterations: number;
  nodeSort?: string[];
  linkStyle: SankeyLinkColor;
  nodeLabelAlign: 'auto' | 'left' | 'right';
  chrome: NormalizedChrome;
  legend?: LegendConfig;
  theme: ThemeConfig;
  darkMode: DarkMode;
  watermark: boolean;
  animation?: AnimationSpec;
  valueFormat?: string;
  linkOpacity?: number;
}
