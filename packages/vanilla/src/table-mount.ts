/**
 * Table mount API: the main entry point for vanilla JS table usage.
 *
 * createTable() takes a container, spec, and options, compiles the table,
 * renders it as HTML, sets up responsive resizing, sort/search/pagination
 * interactivity, and returns a TableInstance with update/resize/export/destroy.
 *
 * Supports both controlled and uncontrolled modes:
 * - Uncontrolled (default): manages sort/search/page internally
 * - Controlled: reads state from externalState, fires onStateChange
 */

import type {
  CompileTableOptions,
  DarkMode,
  SortState,
  TableLayout,
  TableSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { getBreakpoint } from '@opendata-ai/openchart-core';
import { compileTable } from '@opendata-ai/openchart-engine';
import { observeResize } from './resize-observer';
import { attachKeyboardNav } from './table-keyboard';
import { renderTable } from './table-renderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableState {
  sort: SortState | null;
  search: string;
  page: number;
}

export interface TableMountOptions {
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  responsive?: boolean;
  onRowClick?: (row: Record<string, unknown>) => void;
  onStateChange?: (state: TableState) => void;
  externalState?: { sort?: SortState | null; search?: string; page?: number };
}

export interface TableInstance {
  update(spec: TableSpec): void;
  resize(): void;
  export(format: 'csv'): string;
  getState(): TableState;
  setState(partial: Partial<TableState>): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Dark mode resolution
// ---------------------------------------------------------------------------

function resolveDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Sort cycling
// ---------------------------------------------------------------------------

/**
 * Cycle sort state: clicking same column cycles none -> asc -> desc -> none.
 * Clicking a different column resets to asc.
 */
function cycleSort(current: SortState | null, column: string): SortState | null {
  if (!current || current.column !== column) {
    return { column, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { column, direction: 'desc' };
  }
  // desc -> none
  return null;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Create a table instance from a spec and mount it into a container.
 *
 * @param container - The DOM element to render into.
 * @param spec - The table spec.
 * @param options - Mount options.
 * @returns A TableInstance with update/resize/export/destroy methods.
 */
export function createTable(
  container: HTMLElement,
  spec: TableSpec,
  options?: TableMountOptions,
): TableInstance {
  let currentSpec = spec;
  let currentLayout: TableLayout;
  let wrapperElement: HTMLElement | null = null;
  let disconnectResize: (() => void) | null = null;
  let cleanupKeyboard: (() => void) | null = null;
  let destroyed = false;

  // Internal state (used in uncontrolled mode)
  const internalState: TableState = {
    sort: null,
    search: '',
    page: 0,
  };

  // Debounce timers
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const isControlled = options?.externalState !== undefined;

  function getState(): TableState {
    if (isControlled && options?.externalState) {
      return {
        sort: options.externalState.sort ?? null,
        search: options.externalState.search ?? '',
        page: options.externalState.page ?? 0,
      };
    }
    return { ...internalState };
  }

  function updateState(partial: Partial<TableState>): void {
    if (isControlled) {
      // In controlled mode, notify parent
      const current = getState();
      const next: TableState = {
        sort: partial.sort !== undefined ? partial.sort : current.sort,
        search: partial.search !== undefined ? partial.search : current.search,
        page: partial.page !== undefined ? partial.page : current.page,
      };
      options?.onStateChange?.(next);
    } else {
      // In uncontrolled mode, update internal state
      if (partial.sort !== undefined) internalState.sort = partial.sort;
      if (partial.search !== undefined) internalState.search = partial.search;
      if (partial.page !== undefined) internalState.page = partial.page;
      options?.onStateChange?.({ ...internalState });
    }
  }

  function compile(): TableLayout {
    const state = getState();
    const darkMode = resolveDarkMode(options?.darkMode);
    const { width } = getContainerDimensions();

    const compileOpts: CompileTableOptions = {
      width,
      height: 600,
      theme: options?.theme,
      darkMode,
      sort: state.sort ?? undefined,
      search: state.search || undefined,
      page: state.page,
    };

    return compileTable(currentSpec, compileOpts);
  }

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
    };
  }

  /**
   * Announce a message to screen readers via the live region.
   */
  function announce(message: string): void {
    if (!wrapperElement) return;
    const liveRegion = wrapperElement.querySelector('.viz-table-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  /**
   * Apply responsive breakpoint class based on container width.
   * Only auto-adds compact mode at small sizes. Never removes compact
   * if the spec explicitly requests it (layout.compact === true).
   */
  function applyBreakpointClass(): void {
    if (!wrapperElement) return;
    const { width } = getContainerDimensions();
    const bp = getBreakpoint(width);

    if (bp === 'compact' || bp === 'medium') {
      wrapperElement.classList.add('viz-table--compact');
    } else if (!currentLayout?.compact) {
      // Only remove compact if the spec didn't explicitly request it
      wrapperElement.classList.remove('viz-table--compact');
    }
  }

  function render(): void {
    if (destroyed) return;

    try {
      // Clean up previous keyboard nav
      if (cleanupKeyboard) {
        cleanupKeyboard();
        cleanupKeyboard = null;
      }

      // Clean up previous render
      if (wrapperElement?.parentNode) {
        wrapperElement.parentNode.removeChild(wrapperElement);
        wrapperElement = null;
      }

      currentLayout = compile();
      wrapperElement = renderTable(currentLayout, container);

      // Apply dark mode class
      const isDark = resolveDarkMode(options?.darkMode);
      if (isDark) {
        container.classList.add('viz-dark');
      } else {
        container.classList.remove('viz-dark');
      }

      // Apply responsive breakpoint
      applyBreakpointClass();

      // Add clickable class if onRowClick is provided
      if (options?.onRowClick) {
        wrapperElement.classList.add('viz-table--clickable');
      }

      // Wire up event handlers
      wireEvents();

      // Wire up keyboard navigation
      if (wrapperElement) {
        cleanupKeyboard = attachKeyboardNav({
          wrapper: wrapperElement,
          onSort: (columnKey: string) => {
            const state = getState();
            const newSort = cycleSort(state.sort, columnKey);
            updateState({ sort: newSort, page: 0 });

            // Announce sort change
            if (newSort) {
              const dir = newSort.direction === 'asc' ? 'ascending' : 'descending';
              announce(`Sorted by ${columnKey} ${dir}`);
            } else {
              announce('Sort cleared');
            }

            if (!isControlled) {
              rerender();
            }
          },
          onClearSearch: () => {
            updateState({ search: '', page: 0 });
            if (!isControlled) {
              rerender();
            }
          },
          onAnnounce: announce,
        });
      }
    } catch (err) {
      console.error('[viz] Table render failed:', err);
    }
  }

  function wireEvents(): void {
    if (!wrapperElement) return;

    // Sort click handlers on thead buttons
    const sortBtns = wrapperElement.querySelectorAll('[data-sort-column]');
    for (const btn of sortBtns) {
      btn.addEventListener('click', handleSortClick);
    }

    // Search input
    const searchInput = wrapperElement.querySelector(
      '.viz-table-search input',
    ) as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener('input', handleSearchInput);
    }

    // Pagination buttons
    const pageButtons = wrapperElement.querySelectorAll('[data-page-action]');
    for (const btn of pageButtons) {
      btn.addEventListener('click', handlePageClick);
    }

    // Row click
    if (options?.onRowClick) {
      const rows = wrapperElement.querySelectorAll('tbody tr');
      for (const row of rows) {
        row.addEventListener('click', handleRowClick);
      }
    }
  }

  function handleSortClick(e: Event): void {
    const btn = e.currentTarget as HTMLElement;
    const column = btn.getAttribute('data-sort-column');
    if (!column) return;

    const state = getState();
    const newSort = cycleSort(state.sort, column);

    updateState({ sort: newSort, page: 0 });

    // Announce sort change for screen readers
    if (newSort) {
      const dir = newSort.direction === 'asc' ? 'ascending' : 'descending';
      announce(`Sorted by ${column} ${dir}`);
    } else {
      announce('Sort cleared');
    }

    if (!isControlled) {
      rerender();
    }
  }

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const query = input.value;

    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      updateState({ search: query, page: 0 });

      if (!isControlled) {
        rerender();
        // Announce search result count
        const rowCount = currentLayout?.rows?.length ?? 0;
        if (query) {
          announce(`${rowCount} result${rowCount !== 1 ? 's' : ''} found`);
        }
      }
    }, 200);
  }

  function handlePageClick(e: Event): void {
    const btn = e.currentTarget as HTMLElement;
    const action = btn.getAttribute('data-page-action');
    const state = getState();

    if (action === 'prev' && state.page > 0) {
      updateState({ page: state.page - 1 });
    } else if (action === 'next') {
      updateState({ page: state.page + 1 });
    }

    if (!isControlled) {
      rerender();
    }
  }

  function handleRowClick(e: Event): void {
    const tr = e.currentTarget as HTMLElement;
    const rowId = tr.getAttribute('data-row-id');
    if (!rowId || !currentLayout) return;

    const row = currentLayout.rows.find((r) => r.id === rowId);
    if (row) {
      options?.onRowClick?.(row.data);
    }
  }

  /**
   * Re-render the table, preserving search input focus across the DOM rebuild.
   */
  function rerender(): void {
    if (destroyed) return;

    // Capture current search input state before re-render
    const searchInput = wrapperElement?.querySelector(
      '.viz-table-search input',
    ) as HTMLInputElement | null;
    const hadFocus = searchInput && document.activeElement === searchInput;
    const selectionStart = searchInput?.selectionStart ?? 0;
    const selectionEnd = searchInput?.selectionEnd ?? 0;

    render();

    // Restore search focus after re-render
    if (hadFocus) {
      const newInput = wrapperElement?.querySelector(
        '.viz-table-search input',
      ) as HTMLInputElement | null;
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }

  function update(newSpec: TableSpec): void {
    if (destroyed) return;
    currentSpec = newSpec;
    render();
  }

  function resize(): void {
    if (destroyed) return;
    render();
  }

  function doExport(format: 'csv'): string {
    if (format !== 'csv') {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // Export all filtered/sorted data (not just current page)
    // Re-compile without pagination
    const state = getState();
    const darkMode = resolveDarkMode(options?.darkMode);
    const { width } = getContainerDimensions();

    const fullLayout = compileTable(currentSpec, {
      width,
      height: 600,
      theme: options?.theme,
      darkMode,
      sort: state.sort ?? undefined,
      search: state.search || undefined,
      // No page/pageSize: get all rows
    });

    const headers = fullLayout.columns.map((c) => c.label);
    const csvRows = [headers.map(csvEscape).join(',')];

    for (const row of fullLayout.rows) {
      const values = row.cells.map((cell) => csvEscape(cell.formattedValue));
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  function setState(partial: Partial<TableState>): void {
    if (destroyed) return;

    if (partial.sort !== undefined) internalState.sort = partial.sort;
    if (partial.search !== undefined) internalState.search = partial.search;
    if (partial.page !== undefined) internalState.page = partial.page;

    render();
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    if (cleanupKeyboard) {
      cleanupKeyboard();
      cleanupKeyboard = null;
    }
    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (resizeDebounceTimer !== null) {
      clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = null;
    }
    if (disconnectResize) {
      disconnectResize();
      disconnectResize = null;
    }
    if (wrapperElement?.parentNode) {
      wrapperElement.parentNode.removeChild(wrapperElement);
      wrapperElement = null;
    }
    container.classList.remove('viz-dark');
  }

  // Initial render
  render();

  // Set up responsive resize with breakpoint detection
  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, () => {
      if (resizeDebounceTimer !== null) {
        clearTimeout(resizeDebounceTimer);
      }
      resizeDebounceTimer = setTimeout(() => {
        resizeDebounceTimer = null;
        // Update breakpoint class without full re-render when possible
        applyBreakpointClass();
        resize();
      }, 100);
    });
  }

  return {
    update,
    resize,
    export: doExport,
    getState,
    setState,
    destroy,
  };
}
