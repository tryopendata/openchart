/**
 * Tests for useTableState hook.
 *
 * Uses thin wrapper components that expose hook state via the DOM,
 * since renderHook is broken by bun's React dual-instance issue.
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type UseTableStateOptions, useTableState } from '../hooks/useTableState';

// ---------------------------------------------------------------------------
// Test harness: renders hook state to the DOM
// ---------------------------------------------------------------------------

interface HarnessProps {
  initialState?: UseTableStateOptions;
}

function TableStateHarness({ initialState }: HarnessProps) {
  const { sort, search, page, setSort, setSearch, setPage, resetState } =
    useTableState(initialState);

  return (
    <div>
      <span data-testid="sort">{sort ? `${sort.column}:${sort.direction}` : 'null'}</span>
      <span data-testid="search">{search}</span>
      <span data-testid="page">{String(page)}</span>
      <button
        type="button"
        data-testid="set-sort-name-asc"
        onClick={() => setSort({ column: 'name', direction: 'asc' })}
      >
        sort name asc
      </button>
      <button
        type="button"
        data-testid="set-sort-age-desc"
        onClick={() => setSort({ column: 'age', direction: 'desc' })}
      >
        sort age desc
      </button>
      <button type="button" data-testid="clear-sort" onClick={() => setSort(null)}>
        clear sort
      </button>
      <button type="button" data-testid="set-search" onClick={() => setSearch('filter text')}>
        set search
      </button>
      <button type="button" data-testid="set-page-5" onClick={() => setPage(5)}>
        page 5
      </button>
      <button type="button" data-testid="reset" onClick={() => resetState()}>
        reset
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function renderHarness(initialState?: UseTableStateOptions) {
  const result = render(<TableStateHarness initialState={initialState} />);
  // Wait for initial render to complete
  await waitFor(() => {
    expect(result.container.querySelector('[data-testid="page"]')).not.toBeNull();
  });
  return result;
}

function getState(container: HTMLElement) {
  return {
    sort: container.querySelector('[data-testid="sort"]')?.textContent ?? '',
    search: container.querySelector('[data-testid="search"]')?.textContent ?? '',
    page: container.querySelector('[data-testid="page"]')?.textContent ?? '',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTableState', () => {
  // -------------------------------------------------------------------------
  // Default initial state
  // -------------------------------------------------------------------------

  it('initializes with default values when no options provided', async () => {
    const { container } = await renderHarness();
    const state = getState(container);

    expect(state.sort).toBe('null');
    expect(state.search).toBe('');
    expect(state.page).toBe('0');
  });

  // -------------------------------------------------------------------------
  // Custom initial state
  // -------------------------------------------------------------------------

  it('initializes with provided sort state', async () => {
    const { container } = await renderHarness({
      sort: { column: 'name', direction: 'asc' },
    });
    expect(getState(container).sort).toBe('name:asc');
  });

  it('initializes with provided search string', async () => {
    const { container } = await renderHarness({ search: 'hello' });
    expect(getState(container).search).toBe('hello');
  });

  it('initializes with provided page number', async () => {
    const { container } = await renderHarness({ page: 3 });
    expect(getState(container).page).toBe('3');
  });

  // -------------------------------------------------------------------------
  // State setters
  // -------------------------------------------------------------------------

  it('setSort updates the sort state', async () => {
    const { container } = await renderHarness();

    fireEvent.click(container.querySelector('[data-testid="set-sort-age-desc"]')!);
    await waitFor(() => {
      expect(getState(container).sort).toBe('age:desc');
    });
  });

  it('setSort can clear sort by passing null', async () => {
    const { container } = await renderHarness({
      sort: { column: 'name', direction: 'asc' },
    });
    expect(getState(container).sort).toBe('name:asc');

    fireEvent.click(container.querySelector('[data-testid="clear-sort"]')!);
    await waitFor(() => {
      expect(getState(container).sort).toBe('null');
    });
  });

  it('setSearch updates the search query', async () => {
    const { container } = await renderHarness();

    fireEvent.click(container.querySelector('[data-testid="set-search"]')!);
    await waitFor(() => {
      expect(getState(container).search).toBe('filter text');
    });
  });

  it('setPage updates the current page', async () => {
    const { container } = await renderHarness();

    fireEvent.click(container.querySelector('[data-testid="set-page-5"]')!);
    await waitFor(() => {
      expect(getState(container).page).toBe('5');
    });
  });

  // -------------------------------------------------------------------------
  // resetState
  // -------------------------------------------------------------------------

  it('resetState restores default initial values', async () => {
    const { container } = await renderHarness();

    // Change all values
    fireEvent.click(container.querySelector('[data-testid="set-sort-name-asc"]')!);
    fireEvent.click(container.querySelector('[data-testid="set-search"]')!);
    fireEvent.click(container.querySelector('[data-testid="set-page-5"]')!);

    await waitFor(() => {
      expect(getState(container).sort).toBe('name:asc');
      expect(getState(container).search).toBe('filter text');
      expect(getState(container).page).toBe('5');
    });

    // Reset
    fireEvent.click(container.querySelector('[data-testid="reset"]')!);

    await waitFor(() => {
      expect(getState(container).sort).toBe('null');
      expect(getState(container).search).toBe('');
      expect(getState(container).page).toBe('0');
    });
  });

  it('resetState restores custom initial values', async () => {
    const initialState = {
      sort: { column: 'age', direction: 'desc' as const },
      search: 'initial',
      page: 1,
    };
    const { container } = await renderHarness(initialState);

    // Change all values
    fireEvent.click(container.querySelector('[data-testid="clear-sort"]')!);
    fireEvent.click(container.querySelector('[data-testid="set-search"]')!);
    fireEvent.click(container.querySelector('[data-testid="set-page-5"]')!);

    await waitFor(() => {
      expect(getState(container).sort).toBe('null');
      expect(getState(container).search).toBe('filter text');
      expect(getState(container).page).toBe('5');
    });

    // Reset to initial
    fireEvent.click(container.querySelector('[data-testid="reset"]')!);

    await waitFor(() => {
      expect(getState(container).sort).toBe('age:desc');
      expect(getState(container).search).toBe('initial');
      expect(getState(container).page).toBe('1');
    });
  });
});
