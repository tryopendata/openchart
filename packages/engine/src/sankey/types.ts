/**
 * Internal normalized sankey spec type used by the compilation pipeline.
 *
 * This mirrors NormalizedChartSpec/NormalizedGraphSpec: all optional fields
 * have been filled with sensible defaults. It's an engine implementation
 * detail, not a public contract.
 */

import type {
  AnimationSpec,
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
  linkStyle: SankeyLinkColor;
  nodeLabelAlign: 'auto' | 'left' | 'right';
  nodeSort?: string[];
  chrome: NormalizedChrome;
  legend?: LegendConfig;
  theme: ThemeConfig;
  watermark: boolean;
  animation?: AnimationSpec;
  linkOpacity?: number;
  other?: number | { threshold: number; label?: string };
}
