/**
 * Table keyboard navigation: arrow-key cell navigation, Enter to sort,
 * Escape to clear search, and aria-activedescendant management.
 *
 * Designed to be wired up by table-mount.ts after render. Returns a
 * cleanup function to remove listeners on re-render or destroy.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyboardNavOptions {
  /** The wrapper element containing the whole table UI. */
  wrapper: HTMLElement;
  /** Callback to trigger sort on a column. */
  onSort: (columnKey: string) => void;
  /** Callback to clear search and return focus to the table body. */
  onClearSearch: () => void;
  /** Callback to announce text to screen readers via the live region. */
  onAnnounce: (message: string) => void;
}

interface CellPosition {
  row: number;
  col: number;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Attach keyboard navigation to a rendered table.
 *
 * @returns A cleanup function that removes all event listeners.
 */
export function attachKeyboardNav(options: KeyboardNavOptions): () => void {
  const { wrapper, onSort, onClearSearch, onAnnounce } = options;

  let focusedCell: CellPosition = { row: -1, col: 0 };

  const table = wrapper.querySelector('table');
  if (!table) return () => {};

  const tbody = table.querySelector('tbody');
  const thead = table.querySelector('thead');
  if (!tbody || !thead) return () => {};

  // Make tbody focusable
  tbody.setAttribute('tabindex', '0');

  function getRows(): HTMLTableRowElement[] {
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr'));
  }

  function getHeaderCells(): HTMLTableCellElement[] {
    if (!thead) return [];
    const headerRow = thead.querySelector('tr');
    if (!headerRow) return [];
    return Array.from(headerRow.querySelectorAll('th'));
  }

  function getCellsInRow(tr: HTMLTableRowElement): HTMLTableCellElement[] {
    return Array.from(tr.querySelectorAll('td'));
  }

  function getColCount(): number {
    const rows = getRows();
    if (rows.length === 0) return getHeaderCells().length;
    return getCellsInRow(rows[0]).length;
  }

  function clearFocusHighlight(): void {
    const prev = wrapper.querySelector('.viz-table-cell-focus');
    if (prev) {
      prev.classList.remove('viz-table-cell-focus');
      prev.removeAttribute('id');
    }
  }

  function setFocusedCell(row: number, col: number): void {
    clearFocusHighlight();
    const rows = getRows();
    const colCount = getColCount();

    // Clamp values
    if (rows.length === 0) return;
    row = Math.max(0, Math.min(row, rows.length - 1));
    col = Math.max(0, Math.min(col, colCount - 1));

    focusedCell = { row, col };

    // Highlight the cell
    const tr = rows[row];
    if (!tr) return;
    const cells = getCellsInRow(tr);
    const cell = cells[col];
    if (!cell) return;

    const cellId = `viz-cell-${row}-${col}`;
    cell.id = cellId;
    cell.classList.add('viz-table-cell-focus');
    cell.setAttribute('data-row', String(row));
    cell.setAttribute('data-col', String(col));

    // Set aria-activedescendant on tbody
    if (tbody) {
      tbody.setAttribute('aria-activedescendant', cellId);
    }

    // Scroll cell into view if needed
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function handleTbodyFocus(): void {
    // When tbody receives focus, highlight the first cell (or restore last)
    if (focusedCell.row < 0) {
      setFocusedCell(0, 0);
    } else {
      setFocusedCell(focusedCell.row, focusedCell.col);
    }
  }

  function handleTbodyKeydown(e: KeyboardEvent): void {
    const rows = getRows();
    if (rows.length === 0) return;

    const colCount = getColCount();
    const { row, col } = focusedCell;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (row < rows.length - 1) {
          setFocusedCell(row + 1, col);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) {
          setFocusedCell(row - 1, col);
        } else {
          // Move focus to the header
          focusHeaderCell(col);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (col < colCount - 1) {
          setFocusedCell(row, col + 1);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          setFocusedCell(row, col - 1);
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedCell(row, 0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedCell(row, colCount - 1);
        break;
    }
  }

  // Header cell keyboard handling
  function focusHeaderCell(col: number): void {
    const headers = getHeaderCells();
    if (col >= 0 && col < headers.length) {
      clearFocusHighlight();
      headers[col].focus();
    }
  }

  function handleHeaderKeydown(e: KeyboardEvent): void {
    const th = e.currentTarget as HTMLTableCellElement;
    const headers = getHeaderCells();
    const colIndex = headers.indexOf(th);
    if (colIndex < 0) return;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        if (colIndex < headers.length - 1) {
          headers[colIndex + 1].focus();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (colIndex > 0) {
          headers[colIndex - 1].focus();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Move focus to first body row at this column
        if (tbody) {
          tbody.focus();
          setFocusedCell(0, colIndex);
        }
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const sortColumn = th.getAttribute('data-column');
        const sortBtn = th.querySelector('[data-sort-column]');
        if (sortColumn && sortBtn) {
          onSort(sortColumn);
        }
        break;
      }
    }
  }

  // Search escape handling
  const searchInput = wrapper.querySelector('.viz-table-search input') as HTMLInputElement | null;

  function handleSearchKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClearSearch();
      // Return focus to tbody
      if (tbody) {
        tbody.focus();
        onAnnounce('Search cleared');
      }
    }
  }

  // Wire up event listeners
  tbody.addEventListener('focus', handleTbodyFocus);
  tbody.addEventListener('keydown', handleTbodyKeydown as EventListener);

  // Make header cells focusable and wire keyboard
  const headerCells = getHeaderCells();
  for (const th of headerCells) {
    th.setAttribute('tabindex', '0');
    th.addEventListener('keydown', handleHeaderKeydown as EventListener);
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', handleSearchKeydown as EventListener);
  }

  // Cleanup
  return () => {
    tbody.removeEventListener('focus', handleTbodyFocus);
    tbody.removeEventListener('keydown', handleTbodyKeydown as EventListener);

    for (const th of headerCells) {
      th.removeEventListener('keydown', handleHeaderKeydown as EventListener);
    }

    if (searchInput) {
      searchInput.removeEventListener('keydown', handleSearchKeydown as EventListener);
    }

    clearFocusHighlight();
  };
}
