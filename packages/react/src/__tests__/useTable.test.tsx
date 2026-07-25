/**
 * Tests for the useTable hook.
 *
 * Uses thin wrapper components that expose hook state via the DOM,
 * since renderHook is broken by bun's React dual-instance issue.
 *
 * Note: the mount effect includes `options` in its dependency array, so the
 * harness never passes an inline options literal (it would remount on every
 * render). Tests use the no-options path, matching typical usage.
 */

import type { TableSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTable } from '../hooks/useTable';

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
// Harness: renders hook state to the DOM
// ---------------------------------------------------------------------------

function TableHookHarness({ spec }: { spec: TableSpec }) {
  const { ref, table, state } = useTable(spec);
  return (
    <div>
      <div ref={ref} data-testid="table-container" />
      <span data-testid="has-table">{String(table !== null)}</span>
      <span data-testid="page">{String(state.page)}</span>
      <span data-testid="search">{state.search}</span>
      <span data-testid="sort">
        {state.sort ? `${state.sort.column}:${state.sort.direction}` : 'null'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function renderHarness(spec: TableSpec) {
  const result = render(<TableHookHarness spec={spec} />);
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

describe('useTable', () => {
  it('mounts a table instance into the ref container', async () => {
    const { container } = await renderHarness(tableSpec);

    const tableContainer = container.querySelector('[data-testid="table-container"]');
    const table = tableContainer?.querySelector('table');
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll('thead th');
    expect(headers.length).toBe(3);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('exposes the table instance after mount', async () => {
    const { container } = await renderHarness(tableSpec);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="has-table"]')?.textContent).toBe('true');
    });
  });

  it('exposes initial table state', async () => {
    const { container } = await renderHarness(tableSpec);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="page"]')?.textContent).toBe('0');
      expect(container.querySelector('[data-testid="search"]')?.textContent).toBe('');
      expect(container.querySelector('[data-testid="sort"]')?.textContent).toBe('null');
    });
  });

  it('spec changes update the rendered table', async () => {
    const { container, rerender } = await renderHarness(tableSpec);

    expect(container.querySelector('.oc-table-title')?.textContent).toBe('People Table');

    rerender(<TableHookHarness spec={updatedSpec} />);
    await waitFor(() => {
      expect(container.querySelector('.oc-table-title')?.textContent).toBe('Updated Table');
    });

    const headersAfter = container.querySelectorAll('thead th');
    expect(headersAfter.length).toBe(2);
    const rowsAfter = container.querySelectorAll('tbody tr');
    expect(rowsAfter.length).toBe(2);
  });

  it('unmounting cleans up the table instance', async () => {
    const { container, unmount } = await renderHarness(tableSpec);

    expect(container.querySelector('table')).not.toBeNull();

    unmount();

    expect(container.querySelector('table')).toBeNull();
  });
});
