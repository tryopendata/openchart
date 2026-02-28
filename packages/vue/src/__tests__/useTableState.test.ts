/**
 * Tests for useTableState composable.
 *
 * Uses thin wrapper components that expose composable state via the DOM
 * and trigger state changes via button clicks.
 */

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { type UseTableStateOptions, useTableState } from '../composables/useTableState';

// ---------------------------------------------------------------------------
// Test harness: renders composable state to the DOM
// ---------------------------------------------------------------------------

const TableStateHarness = defineComponent({
  props: {
    initialState: {
      type: Object,
      default: undefined,
    },
  },
  setup(props) {
    const { sort, search, page, setSort, setSearch, setPage, resetState } = useTableState(
      props.initialState as UseTableStateOptions | undefined,
    );

    return { sort, search, page, setSort, setSearch, setPage, resetState };
  },
  render() {
    return h('div', [
      h(
        'span',
        { 'data-testid': 'sort' },
        this.sort ? `${this.sort.column}:${this.sort.direction}` : 'null',
      ),
      h('span', { 'data-testid': 'search' }, this.search),
      h('span', { 'data-testid': 'page' }, String(this.page)),
      h(
        'button',
        {
          'data-testid': 'set-sort-name-asc',
          onClick: () => this.setSort({ column: 'name', direction: 'asc' }),
        },
        'sort name asc',
      ),
      h(
        'button',
        {
          'data-testid': 'set-sort-age-desc',
          onClick: () => this.setSort({ column: 'age', direction: 'desc' }),
        },
        'sort age desc',
      ),
      h(
        'button',
        {
          'data-testid': 'clear-sort',
          onClick: () => this.setSort(null),
        },
        'clear sort',
      ),
      h(
        'button',
        {
          'data-testid': 'set-search',
          onClick: () => this.setSearch('filter text'),
        },
        'set search',
      ),
      h(
        'button',
        {
          'data-testid': 'set-page-5',
          onClick: () => this.setPage(5),
        },
        'page 5',
      ),
      h(
        'button',
        {
          'data-testid': 'reset',
          onClick: () => this.resetState(),
        },
        'reset',
      ),
    ]);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mountHarness(initialState?: UseTableStateOptions) {
  const wrapper = mount(TableStateHarness, {
    props: initialState ? { initialState } : {},
  });
  await flushPromises();
  return wrapper;
}

function getState(wrapper: ReturnType<typeof mount>) {
  return {
    sort: wrapper.find('[data-testid="sort"]').text(),
    search: wrapper.find('[data-testid="search"]').text(),
    page: wrapper.find('[data-testid="page"]').text(),
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
    const wrapper = await mountHarness();
    const state = getState(wrapper);

    expect(state.sort).toBe('null');
    expect(state.search).toBe('');
    expect(state.page).toBe('0');
    wrapper.unmount();
  });

  // -------------------------------------------------------------------------
  // Custom initial state
  // -------------------------------------------------------------------------

  it('initializes with provided sort state', async () => {
    const wrapper = await mountHarness({
      sort: { column: 'name', direction: 'asc' },
    });
    expect(getState(wrapper).sort).toBe('name:asc');
    wrapper.unmount();
  });

  it('initializes with provided search string', async () => {
    const wrapper = await mountHarness({ search: 'hello' });
    expect(getState(wrapper).search).toBe('hello');
    wrapper.unmount();
  });

  it('initializes with provided page number', async () => {
    const wrapper = await mountHarness({ page: 3 });
    expect(getState(wrapper).page).toBe('3');
    wrapper.unmount();
  });

  // -------------------------------------------------------------------------
  // State setters
  // -------------------------------------------------------------------------

  it('setSort updates the sort state', async () => {
    const wrapper = await mountHarness();

    await wrapper.find('[data-testid="set-sort-age-desc"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).sort).toBe('age:desc');
    wrapper.unmount();
  });

  it('setSort can clear sort by passing null', async () => {
    const wrapper = await mountHarness({
      sort: { column: 'name', direction: 'asc' },
    });
    expect(getState(wrapper).sort).toBe('name:asc');

    await wrapper.find('[data-testid="clear-sort"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).sort).toBe('null');
    wrapper.unmount();
  });

  it('setSearch updates the search query', async () => {
    const wrapper = await mountHarness();

    await wrapper.find('[data-testid="set-search"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).search).toBe('filter text');
    wrapper.unmount();
  });

  it('setPage updates the current page', async () => {
    const wrapper = await mountHarness();

    await wrapper.find('[data-testid="set-page-5"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).page).toBe('5');
    wrapper.unmount();
  });

  // -------------------------------------------------------------------------
  // resetState
  // -------------------------------------------------------------------------

  it('resetState restores default initial values', async () => {
    const wrapper = await mountHarness();

    // Change all values
    await wrapper.find('[data-testid="set-sort-name-asc"]').trigger('click');
    await wrapper.find('[data-testid="set-search"]').trigger('click');
    await wrapper.find('[data-testid="set-page-5"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).sort).toBe('name:asc');
    expect(getState(wrapper).search).toBe('filter text');
    expect(getState(wrapper).page).toBe('5');

    // Reset
    await wrapper.find('[data-testid="reset"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).sort).toBe('null');
    expect(getState(wrapper).search).toBe('');
    expect(getState(wrapper).page).toBe('0');
    wrapper.unmount();
  });

  it('resetState restores custom initial values', async () => {
    const initialState = {
      sort: { column: 'age', direction: 'desc' as const },
      search: 'initial',
      page: 1,
    };
    const wrapper = await mountHarness(initialState);

    // Change all values
    await wrapper.find('[data-testid="clear-sort"]').trigger('click');
    await wrapper.find('[data-testid="set-search"]').trigger('click');
    await wrapper.find('[data-testid="set-page-5"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).sort).toBe('null');
    expect(getState(wrapper).search).toBe('filter text');
    expect(getState(wrapper).page).toBe('5');

    // Reset to initial
    await wrapper.find('[data-testid="reset"]').trigger('click');
    await flushPromises();

    expect(getState(wrapper).sort).toBe('age:desc');
    expect(getState(wrapper).search).toBe('initial');
    expect(getState(wrapper).page).toBe('1');
    wrapper.unmount();
  });
});
