/**
 * @opendata-ai/react
 *
 * React adapter for openchart. Provides <Chart /> and <DataTable />
 * components that wrap the vanilla adapter with React lifecycle management.
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
export type { ChartProps } from './Chart';
// Components
export { Chart } from './Chart';
export type { DataTableProps } from './DataTable';
export { DataTable } from './DataTable';
export type { GraphProps } from './Graph';
export { Graph } from './Graph';
export type { UseChartOptions, UseChartReturn } from './hooks';

// Hooks
export { useChart, useDarkMode } from './hooks';
export type { GraphHandle, UseGraphReturn } from './hooks/useGraph';
export { useGraph } from './hooks/useGraph';
export type { UseTableReturn } from './hooks/useTable';
export { useTable } from './hooks/useTable';
export type { UseTableStateOptions, UseTableStateReturn } from './hooks/useTableState';
export { useTableState } from './hooks/useTableState';
export type { VizThemeProviderProps } from './ThemeContext';
// Theme context
export { useVizDarkMode, useVizTheme, VizThemeProvider } from './ThemeContext';
