import type { TableSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DataTable from '../DataTable.svelte';

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
// Helper: render DataTable and wait for the table to mount ($effect is deferred)
// ---------------------------------------------------------------------------

async function renderTable(props: { spec: TableSpec; [key: string]: unknown }) {
  const result = render(DataTable, { props });
  await waitFor(() => {
    expect(result.container.querySelector('table')).not.toBeNull();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

describe('<DataTable />', () => {
  it('renders a table', async () => {
    const { container } = await renderTable({ spec: tableSpec });
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
  });

  it('renders correct number of columns', async () => {
    const { container } = await renderTable({ spec: tableSpec });
    const headers = container.querySelectorAll('thead th');
    expect(headers.length).toBe(3);
  });

  it('renders correct number of rows', async () => {
    const { container } = await renderTable({ spec: tableSpec });
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('spec changes trigger re-render', async () => {
    const { container, rerender } = await renderTable({ spec: tableSpec });

    const titleBefore = container.querySelector('.viz-table-title');
    expect(titleBefore?.textContent).toBe('People Table');

    await rerender({ spec: updatedSpec });
    await waitFor(() => {
      expect(container.querySelector('.viz-table-title')?.textContent).toBe('Updated Table');
    });

    const headersAfter = container.querySelectorAll('thead th');
    expect(headersAfter.length).toBe(2);
  });

  it('unmounting cleans up', async () => {
    const { container, unmount } = await renderTable({ spec: tableSpec });

    const tableBefore = container.querySelector('table');
    expect(tableBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('table')).toBeNull();
  });

  it('className passes through', async () => {
    const { container } = await renderTable({ spec: tableSpec, class: 'my-table' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('my-table');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderTable({ spec: tableSpec, darkMode: 'force' });

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderTable({
      spec: tableSpec,
      style: 'border: 1px solid red',
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });
});
