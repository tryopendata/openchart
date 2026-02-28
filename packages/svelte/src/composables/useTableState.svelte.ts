/**
 * useTableState: managed state for controlled table usage.
 *
 * Provides individual sort/search/page state with setters and a
 * resetState function to return to initial values.
 *
 * Uses .svelte.ts extension so runes ($state) work outside
 * .svelte components.
 */

import type { SortState } from '@openchart/core';

export interface UseTableStateOptions {
  sort?: SortState | null;
  search?: string;
  page?: number;
}

export interface UseTableStateReturn {
  readonly sort: SortState | null;
  setSort: (sort: SortState | null) => void;
  readonly search: string;
  setSearch: (query: string) => void;
  readonly page: number;
  setPage: (page: number) => void;
  resetState: () => void;
}

/**
 * Composable for managing table state (sort, search, page).
 *
 * Usage:
 * ```svelte
 * <script>
 *   const state = useTableState();
 * </script>
 * <DataTable
 *   spec={spec}
 *   sort={state.sort}
 *   search={state.search}
 *   page={state.page}
 *   onsortchange={state.setSort}
 *   onsearchchange={state.setSearch}
 *   onpagechange={state.setPage}
 * />
 * ```
 */
export function useTableState(initialState?: UseTableStateOptions): UseTableStateReturn {
  let sort = $state<SortState | null>(initialState?.sort ?? null);
  let search = $state(initialState?.search ?? '');
  let page = $state(initialState?.page ?? 0);

  return {
    get sort() {
      return sort;
    },
    setSort(newSort: SortState | null) {
      sort = newSort;
    },
    get search() {
      return search;
    },
    setSearch(query: string) {
      search = query;
    },
    get page() {
      return page;
    },
    setPage(newPage: number) {
      page = newPage;
    },
    resetState() {
      sort = initialState?.sort ?? null;
      search = initialState?.search ?? '';
      page = initialState?.page ?? 0;
    },
  };
}
