/**
 * Visualization routing component: renders Chart, DataTable, or Graph
 * based on the spec type. Use this when rendering arbitrary VizSpec values.
 *
 * For event handlers, use the specific component (Chart, DataTable, Graph) directly.
 */

import type { DarkMode, ThemeConfig, VizSpec } from '@opendata-ai/openchart-core';
import { isGraphSpec, isSankeySpec, isTableSpec } from '@opendata-ai/openchart-core';
import type { CSSProperties } from 'react';
import { Chart } from './Chart';
import { DataTable } from './DataTable';
import { Graph } from './Graph';
import { Sankey } from './Sankey';

export interface VisualizationProps {
  /** The visualization spec to render. */
  spec: VizSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

/**
 * Routes a VizSpec to the appropriate rendering component.
 *
 * Accepts any VizSpec and renders it with the correct component based on the
 * spec's type field. For event handlers, use Chart, DataTable, or Graph directly.
 */
export function Visualization({ spec, theme, darkMode, className, style }: VisualizationProps) {
  if (isTableSpec(spec)) {
    return (
      <DataTable
        spec={spec}
        theme={theme}
        darkMode={darkMode}
        className={className}
        style={style}
      />
    );
  }
  if (isGraphSpec(spec)) {
    return (
      <Graph spec={spec} theme={theme} darkMode={darkMode} className={className} style={style} />
    );
  }
  if (isSankeySpec(spec)) {
    return (
      <Sankey spec={spec} theme={theme} darkMode={darkMode} className={className} style={style} />
    );
  }
  return (
    <Chart spec={spec} theme={theme} darkMode={darkMode} className={className} style={style} />
  );
}
