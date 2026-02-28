/**
 * Tests for useTableState composable.
 *
 * Since useTableState uses $state runes, it requires running within a Svelte
 * reactive context. We test by verifying the returned object's behavior
 * directly since $state creates reactive getters/setters that work
 * synchronously outside of $effect tracking.
 */

import { describe, expect, it } from 'vitest';
import { useTableState } from '../composables/useTableState.svelte.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTableState', () => {
  // -----------------------------------------------------------------------
  // Default initial state
  // -----------------------------------------------------------------------

  it('initializes with default values when no options provided', () => {
    const state = useTableState();

    expect(state.sort).toBeNull();
    expect(state.search).toBe('');
    expect(state.page).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Custom initial state
  // -----------------------------------------------------------------------

  it('initializes with provided sort state', () => {
    const state = useTableState({
      sort: { column: 'name', direction: 'asc' },
    });
    expect(state.sort).toEqual({ column: 'name', direction: 'asc' });
  });

  it('initializes with provided search string', () => {
    const state = useTableState({ search: 'hello' });
    expect(state.search).toBe('hello');
  });

  it('initializes with provided page number', () => {
    const state = useTableState({ page: 3 });
    expect(state.page).toBe(3);
  });

  // -----------------------------------------------------------------------
  // State setters
  // -----------------------------------------------------------------------

  it('setSort updates the sort state', () => {
    const state = useTableState();

    state.setSort({ column: 'age', direction: 'desc' });
    expect(state.sort).toEqual({ column: 'age', direction: 'desc' });
  });

  it('setSort can clear sort by passing null', () => {
    const state = useTableState({
      sort: { column: 'name', direction: 'asc' },
    });
    expect(state.sort).toEqual({ column: 'name', direction: 'asc' });

    state.setSort(null);
    expect(state.sort).toBeNull();
  });

  it('setSearch updates the search query', () => {
    const state = useTableState();

    state.setSearch('filter text');
    expect(state.search).toBe('filter text');
  });

  it('setPage updates the current page', () => {
    const state = useTableState();

    state.setPage(5);
    expect(state.page).toBe(5);
  });

  // -----------------------------------------------------------------------
  // resetState
  // -----------------------------------------------------------------------

  it('resetState restores default initial values', () => {
    const state = useTableState();

    // Change all values
    state.setSort({ column: 'name', direction: 'asc' });
    state.setSearch('filter text');
    state.setPage(5);

    expect(state.sort).toEqual({ column: 'name', direction: 'asc' });
    expect(state.search).toBe('filter text');
    expect(state.page).toBe(5);

    // Reset
    state.resetState();

    expect(state.sort).toBeNull();
    expect(state.search).toBe('');
    expect(state.page).toBe(0);
  });

  it('resetState restores custom initial values', () => {
    const initialState = {
      sort: { column: 'age', direction: 'desc' as const },
      search: 'initial',
      page: 1,
    };
    const state = useTableState(initialState);

    // Change all values
    state.setSort(null);
    state.setSearch('changed');
    state.setPage(5);

    expect(state.sort).toBeNull();
    expect(state.search).toBe('changed');
    expect(state.page).toBe(5);

    // Reset to initial
    state.resetState();

    expect(state.sort).toEqual({ column: 'age', direction: 'desc' });
    expect(state.search).toBe('initial');
    expect(state.page).toBe(1);
  });
});
