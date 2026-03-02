/**
 * @opendata-ai/svelte
 *
 * Svelte 5 adapter for openchart. Provides <Chart />, <DataTable />,
 * and <Graph /> components that wrap the vanilla adapter with Svelte
 * lifecycle management using runes.
 */

// Re-export core types for convenience
export type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  TableLayout,
  TableSpec,
  VizSpec,
} from '@opendata-ai/engine';
// Components
export { default as Chart } from './Chart.svelte';
export type { UseChartOptions, UseChartReturn } from './composables/useChart.svelte.js';
export { useChart } from './composables/useChart.svelte.js';
// Composables
export { useDarkMode } from './composables/useDarkMode.svelte.js';
export type { UseGraphOptions, UseGraphReturn } from './composables/useGraph.svelte.js';
export { useGraph } from './composables/useGraph.svelte.js';
export type { UseTableReturn } from './composables/useTable.svelte.js';
export { useTable } from './composables/useTable.svelte.js';
export type {
  UseTableStateOptions,
  UseTableStateReturn,
} from './composables/useTableState.svelte.js';
export { useTableState } from './composables/useTableState.svelte.js';
// Context
export { getVizDarkMode, getVizTheme, setVizDarkMode, setVizTheme } from './context.js';
export { default as DataTable } from './DataTable.svelte';
export { default as Graph } from './Graph.svelte';
export { default as VizThemeProvider } from './ThemeProvider.svelte';
// Component prop types
export type {
  ChartProps,
  DataTableProps,
  GraphProps,
  VizThemeProviderProps,
} from './types.js';
