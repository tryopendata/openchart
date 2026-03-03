/**
 * @opendata-ai/openchart-vue
 *
 * Vue 3 adapter for openchart. Provides <Chart />, <DataTable />, <Graph />,
 * and <VizThemeProvider /> components that wrap the vanilla adapter with
 * Vue lifecycle management.
 */

// Re-export core types for convenience
export type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  TableLayout,
  TableSpec,
  VizSpec,
} from '@opendata-ai/openchart-engine';

// Components
export type { ChartProps } from './Chart';
export { Chart } from './Chart';
// Composables
export type { UseChartOptions, UseChartReturn } from './composables/useChart';
export { useChart } from './composables/useChart';
export { useDarkMode } from './composables/useDarkMode';
export type { GraphHandle, UseGraphReturn } from './composables/useGraph';
export { useGraph } from './composables/useGraph';
export type { UseTableReturn } from './composables/useTable';
export { useTable } from './composables/useTable';
export type { UseTableStateOptions, UseTableStateReturn } from './composables/useTableState';
export { useTableState } from './composables/useTableState';
// Context (injection keys and composables)
export { useVizDarkMode, useVizTheme, VizDarkModeKey, VizThemeKey } from './context';
export type { DataTableProps } from './DataTable';
export { DataTable } from './DataTable';
export type { GraphProps } from './Graph';
export { Graph } from './Graph';
export type { VizThemeProviderProps } from './ThemeProvider';
export { VizThemeProvider } from './ThemeProvider';
