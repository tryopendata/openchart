/**
 * Tests for the useTable composable.
 *
 * Uses a thin harness component that attaches the composable's containerRef
 * to a div and exposes the table/state refs for assertions.
 */

import type { TableSpec } from '@opendata-ai/openchart-core';
import type { TableInstance } from '@opendata-ai/openchart-vanilla';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, type PropType, toRef } from 'vue';
import { useTable } from '../composables/useTable';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const tableSpec: TableSpec = {
  type: 'table',
  data: [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
    { name: 'Charlie', age: 35 },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
  ],
};

const updatedSpec: TableSpec = {
  type: 'table',
  data: [
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 5, z: 6 },
  ],
  columns: [
    { key: 'x', label: 'X' },
    { key: 'y', label: 'Y' },
    { key: 'z', label: 'Z' },
  ],
};

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const TableHarness = defineComponent({
  props: {
    spec: {
      type: Object as PropType<TableSpec>,
      required: true,
    },
  },
  setup(props) {
    const specRef = toRef(props, 'spec');
    const { containerRef, table, state } = useTable(specRef);
    return { containerRef, table, state };
  },
  render() {
    return h('div', [
      h('div', { ref: 'containerRef', 'data-testid': 'table-container' }),
      h('span', { 'data-testid': 'has-table' }, String(this.table !== null)),
      h('span', { 'data-testid': 'page' }, String(this.state.page)),
      h('span', { 'data-testid': 'search' }, this.state.search),
      h('span', { 'data-testid': 'sort' }, this.state.sort === null ? 'null' : 'set'),
    ]);
  },
});

async function mountHarness(spec: TableSpec) {
  const wrapper = mount(TableHarness, { props: { spec } });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTable', () => {
  it('mounts a table instance into the container ref', async () => {
    const wrapper = await mountHarness(tableSpec);

    const container = wrapper.find('[data-testid="table-container"]');
    expect(container.find('table').exists()).toBe(true);
    expect(container.findAll('thead th').length).toBe(2);
    expect(wrapper.find('[data-testid="has-table"]').text()).toBe('true');
    wrapper.unmount();
  });

  it('exposes the initial table state after mounting', async () => {
    const wrapper = await mountHarness(tableSpec);

    expect(wrapper.find('[data-testid="page"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="search"]').text()).toBe('');
    expect(wrapper.find('[data-testid="sort"]').text()).toBe('null');
    wrapper.unmount();
  });

  it('updates the table when the spec ref changes', async () => {
    const wrapper = await mountHarness(tableSpec);

    expect(wrapper.findAll('thead th').length).toBe(2);

    await wrapper.setProps({ spec: updatedSpec });
    await flushPromises();

    expect(wrapper.findAll('thead th').length).toBe(3);
    wrapper.unmount();
  });

  it('destroys the table instance on unmount', async () => {
    const wrapper = await mountHarness(tableSpec);

    const vm = wrapper.vm as unknown as { table: TableInstance | null };
    const instance = vm.table;
    expect(instance).not.toBeNull();

    const destroySpy = vi.spyOn(instance as TableInstance, 'destroy');
    wrapper.unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
