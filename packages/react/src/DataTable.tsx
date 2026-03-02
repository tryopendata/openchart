/**
 * DataTable component: React wrapper around the vanilla table adapter.
 *
 * Mounts a table instance on render, updates when spec changes,
 * and cleans up on unmount. Supports both controlled and uncontrolled modes
 * for sort, search, and pagination state.
 */

import type { DarkMode, SortState, TableSpec, ThemeConfig } from '@opendata-ai/core';
import { createTable, type TableInstance, type TableMountOptions } from '@opendata-ai/vanilla';
import { type CSSProperties, useEffect, useRef } from 'react';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

export interface DataTableProps {
  /** The table spec to render. */
  spec: TableSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Row click handler. */
  onRowClick?: (row: Record<string, unknown>) => void;
  /** Callback when sort changes. */
  onSortChange?: (sort: SortState | null) => void;
  /** Callback when search changes. */
  onSearchChange?: (query: string) => void;
  /** Callback when page changes. */
  onPageChange?: (page: number) => void;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
  /** Controlled sort state. */
  sort?: SortState | null;
  /** Controlled search query. */
  search?: string;
  /** Controlled page number. */
  page?: number;
}

/**
 * React component that renders a data table from a TableSpec.
 *
 * Uses the vanilla adapter internally. Supports controlled and uncontrolled
 * modes for sort, search, and pagination state.
 */
export function DataTable({
  spec,
  theme: themeProp,
  darkMode,
  onRowClick,
  onSortChange,
  onSearchChange,
  onPageChange,
  className,
  style,
  sort,
  search,
  page,
}: DataTableProps) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = themeProp ?? contextTheme;
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<TableInstance | null>(null);
  const prevSpecRef = useRef<TableSpec | null>(null);

  // Determine if we're in controlled mode
  const isControlled = sort !== undefined || search !== undefined || page !== undefined;

  // Effect 1: Mount/unmount. Only recreate when structural options change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mountOptions: TableMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onRowClick,
      responsive: true,
      onStateChange: (state) => {
        if (state.sort !== undefined) onSortChange?.(state.sort);
        if (state.search !== undefined) onSearchChange?.(state.search);
        if (state.page !== undefined) onPageChange?.(state.page);
      },
    };

    if (isControlled) {
      mountOptions.externalState = {
        sort: sort ?? null,
        search: search ?? '',
        page: page ?? 0,
      };
    }

    tableRef.current = createTable(container, spec, mountOptions);
    prevSpecRef.current = spec;

    return () => {
      tableRef.current?.destroy();
      tableRef.current = null;
    };
    // Only recreate on structural option changes (theme, darkMode, onRowClick).
    // Controlled state updates are handled in Effect 2.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme,
    resolvedDarkMode,
    onRowClick,
    isControlled,
    onPageChange,
    onSearchChange,
    onSortChange,
    page,
    search,
    sort,
    spec,
  ]);

  // Effect 2: Sync controlled state without remounting.
  useEffect(() => {
    const table = tableRef.current;
    if (!table || !isControlled) return;

    table.setState({
      sort: sort ?? null,
      search: search ?? '',
      page: page ?? 0,
    });
  }, [sort, search, page, isControlled]);

  // Effect 3: Sync spec changes via update().
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    // Use reference equality; users should memoize with useMemo if needed
    if (spec !== prevSpecRef.current) {
      prevSpecRef.current = spec;
      table.update(spec);
    }
  }, [spec]);

  return (
    <div
      ref={containerRef}
      className={className ? `viz-table-root ${className}` : 'viz-table-root'}
      style={style}
    />
  );
}
