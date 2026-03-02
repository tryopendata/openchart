import type { TableSpec } from '@opendata-ai/core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../DataTable';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const tableSpec: TableSpec = {
  type: 'table',
  data: [
    { name: 'Alice', age: 30, city: 'Portland' },
    { name: 'Bob', age: 25, city: 'Seattle' },
    { name: 'Charlie', age: 35, city: 'Denver' },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
    { key: 'city', label: 'City' },
  ],
  chrome: { title: 'People Table' },
};

const updatedSpec: TableSpec = {
  type: 'table',
  data: [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ],
  columns: [
    { key: 'x', label: 'X Value' },
    { key: 'y', label: 'Y Value' },
  ],
  chrome: { title: 'Updated Table' },
};

// ---------------------------------------------------------------------------
// Helper: mount DataTable and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountTable(props: {
  spec: TableSpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(DataTable, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataTable', () => {
  it('renders a table', async () => {
    const wrapper = await mountTable({ spec: tableSpec });
    const table = wrapper.find('table');
    expect(table.exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders correct number of columns', async () => {
    const wrapper = await mountTable({ spec: tableSpec });
    const headers = wrapper.findAll('thead th');
    expect(headers.length).toBe(3);
    wrapper.unmount();
  });

  it('renders correct number of rows', async () => {
    const wrapper = await mountTable({ spec: tableSpec });
    const rows = wrapper.findAll('tbody tr');
    expect(rows.length).toBe(3);
    wrapper.unmount();
  });

  it('spec changes trigger re-render', async () => {
    const wrapper = await mountTable({ spec: tableSpec });

    const titleBefore = wrapper.find('.viz-table-title');
    expect(titleBefore.text()).toBe('People Table');

    await wrapper.setProps({ spec: updatedSpec });
    await flushPromises();

    const titleAfter = wrapper.find('.viz-table-title');
    expect(titleAfter.text()).toBe('Updated Table');

    const headersAfter = wrapper.findAll('thead th');
    expect(headersAfter.length).toBe(2);
    wrapper.unmount();
  });

  it('unmounting cleans up', async () => {
    const wrapper = await mountTable({ spec: tableSpec });

    const tableBefore = wrapper.find('table');
    expect(tableBefore.exists()).toBe(true);

    wrapper.unmount();

    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('class prop passes through', async () => {
    const wrapper = await mountTable({ spec: tableSpec, class: 'my-table' });

    expect(wrapper.classes()).toContain('my-table');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountTable({ spec: tableSpec, darkMode: 'force' });

    const table = wrapper.find('table');
    expect(table.exists()).toBe(true);
    wrapper.unmount();
  });

  it('style prop passes through to wrapper div', async () => {
    const wrapper = await mountTable({
      spec: tableSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
  });
});
