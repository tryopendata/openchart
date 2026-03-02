/**
 * useTableState: managed state composable for controlled table usage.
 *
 * Provides individual sort/search/page state with setters and a
 * resetState function to return to initial values.
 */

import type { SortState } from '@opendata-ai/core';
import { type Ref, ref } from 'vue';

export interface UseTableStateReturn {
  sort: Ref<SortState | null>;
  setSort: (sort: SortState | null) => void;
  search: Ref<string>;
  setSearch: (query: string) => void;
  page: Ref<number>;
  setPage: (page: number) => void;
  resetState: () => void;
}

export interface UseTableStateOptions {
  sort?: SortState | null;
  search?: string;
  page?: number;
}

/**
 * Composable for managing table state (sort, search, page).
 *
 * Use with the DataTable component's controlled props:
 * ```vue
 * <script setup>
 * const { sort, search, page, setSort, setSearch, setPage } = useTableState();
 * </script>
 * <template>
 *   <DataTable
 *     :spec="spec"
 *     :sort="sort"
 *     :search="search"
 *     :page="page"
 *     @update:sort="setSort"
 *     @update:search="setSearch"
 *     @update:page="setPage"
 *   />
 * </template>
 * ```
 */
export function useTableState(initialState?: UseTableStateOptions): UseTableStateReturn {
  const sort = ref<SortState | null>(initialState?.sort ?? null);
  const search = ref(initialState?.search ?? '');
  const page = ref(initialState?.page ?? 0);

  function setSort(newSort: SortState | null) {
    sort.value = newSort;
  }

  function setSearch(query: string) {
    search.value = query;
  }

  function setPage(newPage: number) {
    page.value = newPage;
  }

  function resetState() {
    sort.value = initialState?.sort ?? null;
    search.value = initialState?.search ?? '';
    page.value = initialState?.page ?? 0;
  }

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
