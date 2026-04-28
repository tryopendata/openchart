/**
 * Visualization routing component: renders Chart, DataTable, or Graph
 * based on the spec type. Use this when rendering arbitrary VizSpec values.
 *
 * For event handlers, use the specific component (Chart, DataTable, Graph) directly.
 */

import type { DarkMode, ThemeConfig, VizSpec } from '@opendata-ai/openchart-core';
import { isGraphSpec, isSankeySpec, isTableSpec, isTileMapSpec } from '@opendata-ai/openchart-core';
import { type CSSProperties, defineComponent, h, type PropType } from 'vue';
import { Chart } from './Chart';
import { DataTable } from './DataTable';
import { Graph } from './Graph';
import { Sankey } from './Sankey';
import { TileMap } from './TileMap';

export interface VisualizationProps {
  spec: VizSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const Visualization = defineComponent({
  name: 'Visualization',
  props: {
    spec: {
      type: Object as PropType<VizSpec>,
      required: true,
    },
    theme: {
      type: Object as PropType<ThemeConfig>,
      default: undefined,
    },
    darkMode: {
      type: String as PropType<DarkMode>,
      default: undefined,
    },
    class: {
      type: String,
      default: undefined,
    },
    style: {
      type: [String, Object] as PropType<string | CSSProperties>,
      default: undefined,
    },
  },
  setup(props) {
    return () => {
      const { spec, theme, darkMode, class: className, style } = props;
      const sharedProps = { theme, darkMode, class: className, style };

      if (isTableSpec(spec)) {
        return h(DataTable, { ...sharedProps, spec });
      }
      if (isGraphSpec(spec)) {
        return h(Graph, { ...sharedProps, spec });
      }
      if (isSankeySpec(spec)) {
        return h(Sankey, { ...sharedProps, spec });
      }
      if (isTileMapSpec(spec)) {
        return h(TileMap, { ...sharedProps, spec });
      }
      return h(Chart, { ...sharedProps, spec });
    };
  },
});
