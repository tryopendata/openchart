/**
 * useTableState: managed state hook for controlled table usage.
 *
 * Provides individual sort/search/page state with setters and a
 * resetState function to return to initial values.
 */

import type { SortState } from '@opendata-ai/openchart-core';
import { useCallback, useState } from 'react';

export interface UseTableStateReturn {
  sort: SortState | null;
  setSort: (sort: SortState | null) => void;
  search: string;
  setSearch: (query: string) => void;
  page: number;
  setPage: (page: number) => void;
  resetState: () => void;
}

export interface UseTableStateOptions {
  sort?: SortState | null;
  search?: string;
  page?: number;
}

/**
 * Hook for managing table state (sort, search, page).
 *
 * Use with the DataTable component's controlled props:
 * ```tsx
 * const { sort, search, page, setSort, setSearch, setPage } = useTableState();
 * <DataTable
 *   spec={spec}
 *   sort={sort}
 *   search={search}
 *   page={page}
 *   onSortChange={setSort}
 *   onSearchChange={setSearch}
 *   onPageChange={setPage}
 * />
 * ```
 */
export function useTableState(initialState?: UseTableStateOptions): UseTableStateReturn {
  const [sort, setSortInternal] = useState<SortState | null>(initialState?.sort ?? null);
  const [search, setSearchInternal] = useState(initialState?.search ?? '');
  const [page, setPageInternal] = useState(initialState?.page ?? 0);

  const setSort = useCallback((newSort: SortState | null) => {
    setSortInternal(newSort);
  }, []);

  const setSearch = useCallback((query: string) => {
    setSearchInternal(query);
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageInternal(newPage);
  }, []);

  const resetState = useCallback(() => {
    setSortInternal(initialState?.sort ?? null);
    setSearchInternal(initialState?.search ?? '');
    setPageInternal(initialState?.page ?? 0);
  }, [initialState?.sort, initialState?.search, initialState?.page]);

  return {
    sort,
    setSort,
    search,
    setSearch,
    page,
    setPage,
    resetState,
  };
}
