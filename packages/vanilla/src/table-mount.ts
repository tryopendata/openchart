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
import { BREAKPOINT_COMPACT_MAX } from '@opendata-ai/openchart-core';
import { compileTable } from '@opendata-ai/openchart-engine';
import { setupTableAnimationCleanup } from './animation';
import { observeResize } from './resize-observer';
import { resolveDarkMode } from './resolve-dark-mode';
import { attachKeyboardNav } from './table-keyboard';
import { renderTable } from './table-renderer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width a text column needs before its values start wrapping. */
const MIN_READABLE_COLUMN_WIDTH = 96;

/** Below this width even a two-column table reads better condensed. */
const AUTO_CONDENSE_MAX_WIDTH = 560;

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
  /** Show the OpenData watermark. Defaults to true. */
  watermark?: boolean;
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
  let cleanupAnimations: (() => void) | null = null;
  let isFirstRender = true;
  let destroyed = false;
  // Whether the user has touched sorting. Once they have, a null sort means
  // "explicitly unsorted" and must not fall back to the spec/bar-column default.
  let sortTouched = false;

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
      if (partial.sort !== undefined) sortTouched = true;
      options?.onStateChange?.(next);
    } else {
      // In uncontrolled mode, update internal state
      if (partial.sort !== undefined) {
        internalState.sort = partial.sort;
        sortTouched = true;
      }
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
      watermark: options?.watermark,
      // undefined = "no opinion, apply the spec default"; null = the user
      // cycled sorting off and expects the original row order back. A
      // controlled caller's natural initial `sort: null` means "no opinion"
      // until the user has actually touched sorting.
      sort: resolveEffectiveSort(state),
      search: state.search || undefined,
      page: state.page,
    };

    return compileTable(currentSpec, compileOpts);
  }

  /** The sort once the user has touched it, otherwise defer to the spec. */
  function sameSort(a: SortState | null, b: SortState | null): boolean {
    if (a === null || b === null) return a === b;
    return a.column === b.column && a.direction === b.direction;
  }

  function resolveEffectiveSort(state: TableState): SortState | null | undefined {
    return sortTouched ? state.sort : (state.sort ?? undefined);
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
    const liveRegion = wrapperElement.querySelector('.oc-table-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  /**
   * Apply responsive classes based on container width.
   *
   * Cards mode below 400px; auto-condense only under real content pressure
   * (more columns than the width can give 96px each, or a narrow embed).
   * `getBreakpoint` calls everything up to 700px "medium", so keying on it
   * condensed every 600-720px editorial column that had room to breathe.
   * An explicit `density` (or the deprecated `compact`) always wins.
   */
  function applyBreakpointClass(): void {
    if (!wrapperElement) return;
    const { width } = getContainerDimensions();

    wrapperElement.classList.toggle('oc-table--cards', width < BREAKPOINT_COMPACT_MAX);

    if (currentSpec.density !== undefined || currentSpec.compact === true) return;

    const columns = currentLayout?.columns.length ?? 0;
    const condensed =
      columns * MIN_READABLE_COLUMN_WIDTH > width || width < AUTO_CONDENSE_MAX_WIDTH;

    wrapperElement.classList.toggle('oc-table--condensed', condensed);
    wrapperElement.classList.toggle('oc-table--compact', condensed);
    wrapperElement.classList.toggle('oc-table--regular', !condensed);
  }

  function render(): void {
    if (destroyed) return;

    try {
      // Cancel any in-flight animations before re-rendering
      if (cleanupAnimations) {
        cleanupAnimations();
        cleanupAnimations = null;
      }

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
      const shouldAnimate = isFirstRender && !!currentLayout.animation?.enter;
      wrapperElement = renderTable(currentLayout, container, { animate: shouldAnimate });

      // Set up animation cleanup on first animated render
      if (shouldAnimate && wrapperElement) {
        cleanupAnimations = setupTableAnimationCleanup(wrapperElement);
      }
      if (isFirstRender) {
        isFirstRender = false;
      }

      // Apply dark mode class
      const isDark = resolveDarkMode(options?.darkMode);
      if (isDark) {
        container.classList.add('oc-dark');
      } else {
        container.classList.remove('oc-dark');
      }

      // Apply responsive breakpoint
      applyBreakpointClass();

      // Add clickable class if onRowClick is provided
      if (options?.onRowClick) {
        wrapperElement.classList.add('oc-table--clickable');
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
      '.oc-table-search input',
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
      '.oc-table-search input',
    ) as HTMLInputElement | null;
    const hadFocus = searchInput && document.activeElement === searchInput;
    const selectionStart = searchInput?.selectionStart ?? 0;
    const selectionEnd = searchInput?.selectionEnd ?? 0;

    render();

    // Restore search focus after re-render
    if (hadFocus) {
      const newInput = wrapperElement?.querySelector(
        '.oc-table-search input',
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
    if (cleanupAnimations) return; // Skip resize during entrance animation
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
      sort: resolveEffectiveSort(state),
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

    // In controlled mode compile() reads from options.externalState, so
    // updating internalState alone would be ignored. Push the new values onto
    // externalState (the source getState() reads) so the render reflects them.
    // An explicit sort that actually changes the state -- including a change
    // to null -- is the caller taking a position on sorting, so from here on a
    // null sort means "cleared", not "no opinion". A no-op sync (the React and
    // Svelte wrappers push their initial `sort: null` on mount) must not count,
    // or spec.sort would be dropped before the first interaction.
    if (partial.sort !== undefined && !sameSort(partial.sort, getState().sort)) {
      sortTouched = true;
    }

    if (isControlled && options?.externalState) {
      if (partial.sort !== undefined) options.externalState.sort = partial.sort;
      if (partial.search !== undefined) options.externalState.search = partial.search;
      if (partial.page !== undefined) options.externalState.page = partial.page;
    } else {
      if (partial.sort !== undefined) internalState.sort = partial.sort;
      if (partial.search !== undefined) internalState.search = partial.search;
      if (partial.page !== undefined) internalState.page = partial.page;
    }

    render();
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    if (cleanupAnimations) {
      cleanupAnimations();
      cleanupAnimations = null;
    }
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
    container.classList.remove('oc-dark');
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
