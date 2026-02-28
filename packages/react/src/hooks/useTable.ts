/**
 * useTable: hook for manual table lifecycle control.
 *
 * Attaches to a container ref, mounts a vanilla table instance,
 * and exposes the instance and current state.
 */

import type { TableSpec } from '@openchart/core';
import {
  createTable,
  type TableInstance,
  type TableMountOptions,
  type TableState,
} from '@openchart/vanilla';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseTableReturn {
  /** Ref to attach to the container div. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** The table instance (null until mounted). */
  table: TableInstance | null;
  /** The current table state (sort, search, page). */
  state: TableState;
}

/**
 * Hook for manual table lifecycle control.
 *
 * Attach the returned ref to a container div. The table mounts
 * automatically and updates when the spec changes.
 *
 * @param spec - The table spec.
 * @param options - Mount options.
 * @returns { ref, table, state }
 */
export function useTable(spec: TableSpec, options?: TableMountOptions): UseTableReturn {
  const ref = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<TableInstance | null>(null);
  const [state, setState] = useState<TableState>({
    sort: null,
    search: '',
    page: 0,
  });

  const originalOnStateChange = options?.onStateChange;

  const handleStateChange = useCallback(
    (newState: TableState) => {
      setState(newState);
      originalOnStateChange?.(newState);
    },
    [originalOnStateChange],
  );

  // Mount / unmount
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const mountOpts: TableMountOptions = {
      ...options,
      onStateChange: handleStateChange,
    };

    const table = createTable(container, spec, mountOpts);
    tableRef.current = table;
    setState(table.getState());

    return () => {
      table.destroy();
      tableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options?.theme,
    options?.darkMode,
    options?.onRowClick,
    options?.responsive,
    handleStateChange,
    options,
    spec,
  ]);

  // Update on spec change
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    table.update(spec);
    setState(table.getState());
  }, [spec]);

  return {
    ref,
    table: tableRef.current,
    state,
  };
}
