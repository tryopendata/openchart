import type { TableSpec } from '@opendata-ai/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTable } from '../table-mount';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeSpec(overrides?: Partial<TableSpec>): TableSpec {
  return {
    type: 'table',
    data: [
      { name: 'Alice', age: 30, city: 'Portland' },
      { name: 'Bob', age: 25, city: 'Seattle' },
      { name: 'Charlie', age: 35, city: 'Portland' },
      { name: 'Diana', age: 28, city: 'Denver' },
      { name: 'Eve', age: 22, city: 'Seattle' },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'city', label: 'City' },
    ],
    chrome: { title: 'People' },
    ...overrides,
  };
}

const paginatedSpec: TableSpec = {
  type: 'table',
  data: Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    value: (i * 17 + 3) % 100,
  })),
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value' },
  ],
  pagination: { pageSize: 10 },
  search: true,
};

const heatmapSpec: TableSpec = {
  type: 'table',
  data: [
    { name: 'A', score: 10 },
    { name: 'B', score: 50 },
    { name: 'C', score: 90 },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'score', label: 'Score', heatmap: {} },
  ],
};

const barSpec: TableSpec = {
  type: 'table',
  data: [
    { name: 'A', value: 250 },
    { name: 'B', value: 750 },
    { name: 'C', value: 500 },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value', bar: {} },
  ],
};

const sparklineSpec: TableSpec = {
  type: 'table',
  data: [
    { name: 'A', trend: [1, 3, 2, 5, 4] },
    { name: 'B', trend: [5, 4, 3, 2, 1] },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'trend', label: 'Trend', sparkline: { type: 'line' } },
  ],
};

const stickySpec: TableSpec = {
  type: 'table',
  data: [{ name: 'A', v1: 1, v2: 2, v3: 3 }],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'v1', label: 'V1' },
    { key: 'v2', label: 'V2' },
    { key: 'v3', label: 'V3' },
  ],
  stickyFirstColumn: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createTable', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a <table> element', () => {
    const table = createTable(container, makeSpec());
    const tableEl = container.querySelector('table');
    expect(tableEl).not.toBeNull();
    table.destroy();
  });

  it('renders correct number of rows and columns', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells.length).toBe(3);

    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(5);

    table.destroy();
  });

  it('renders column headers with correct labels', () => {
    const table = createTable(container, makeSpec());

    const headers = container.querySelectorAll('thead th');
    expect(headers[0]?.textContent).toContain('Name');
    expect(headers[1]?.textContent).toContain('Age');
    expect(headers[2]?.textContent).toContain('City');

    table.destroy();
  });

  it('sort click re-renders sorted data', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    // Click sort button for "Age"
    const sortBtns = container.querySelectorAll('[data-sort-column]');
    const ageBtn = Array.from(sortBtns).find(
      (btn) => btn.getAttribute('data-sort-column') === 'age',
    );
    expect(ageBtn).not.toBeNull();
    ageBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    // After sorting by age ascending, first row should be youngest
    const firstRowCells = container.querySelectorAll('tbody tr:first-child td');
    // Eve (22) should be first
    expect(firstRowCells[0]?.textContent).toBe('Eve');

    table.destroy();
  });

  it('sort cycling: none -> asc -> desc -> none', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    const sortBtn = container.querySelector('[data-sort-column="age"]')!;

    // Click 1: asc
    sortBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(table.getState().sort).toEqual({ column: 'age', direction: 'asc' });

    // Click 2: desc
    sortBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(table.getState().sort).toEqual({ column: 'age', direction: 'desc' });

    // Click 3: none
    sortBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(table.getState().sort).toBeNull();

    table.destroy();
  });

  it('search input filters rows', () => {
    vi.useFakeTimers();
    try {
      const spec = makeSpec({ search: true });
      const table = createTable(container, spec);

      const input = container.querySelector('.viz-table-search input') as HTMLInputElement;
      expect(input).not.toBeNull();

      // Type in a search query
      input.value = 'Portland';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Advance past the 200ms debounce
      vi.advanceTimersByTime(200);

      // Should show only Portland rows (Alice and Charlie)
      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);

      table.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pagination controls navigate pages', () => {
    const table = createTable(container, paginatedSpec);

    // Should show page 1 of 5 (10 per page, 50 total)
    const info = container.querySelector('.viz-table-pagination-info');
    expect(info?.textContent).toContain('Showing 1-10 of 50');

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(10);

    // Click next page
    const nextBtn = container.querySelector('[data-page-action="next"]') as HTMLButtonElement;
    expect(nextBtn).not.toBeNull();
    nextBtn.dispatchEvent(new Event('click', { bubbles: true }));

    const infoAfter = container.querySelector('.viz-table-pagination-info');
    expect(infoAfter?.textContent).toContain('Showing 11-20 of 50');

    // Previous button should be enabled
    const prevBtn = container.querySelector('[data-page-action="prev"]') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(false);

    table.destroy();
  });

  it('sticky first column CSS applied', () => {
    const table = createTable(container, stickySpec);

    const tableEl = container.querySelector('table');
    expect(tableEl?.classList.contains('viz-table--sticky')).toBe(true);

    table.destroy();
  });

  it('heatmap cells have colored backgrounds', () => {
    const table = createTable(container, heatmapSpec);

    // The heatmap cells should have background styles
    const bodyRows = container.querySelectorAll('tbody tr');
    const cells = bodyRows[2]?.querySelectorAll('td');
    // Score column (index 1) should have background color
    const scoreCellHigh = cells?.[1];
    expect(
      scoreCellHigh?.style.background !== '' || scoreCellHigh?.style.backgroundColor !== '',
    ).toBe(true);

    table.destroy();
  });

  it('sparkline cells contain inline SVG', () => {
    const table = createTable(container, sparklineSpec);

    // Sparkline cells should be rendered with the sparkline class
    const sparklineCells = container.querySelectorAll('.viz-table-sparkline');
    expect(sparklineCells.length).toBeGreaterThan(0);

    const svg = sparklineCells[0]?.querySelector('svg');
    expect(svg).not.toBeNull();

    // Line sparkline should have a polyline
    const polyline = svg?.querySelector('polyline');
    expect(polyline).not.toBeNull();

    table.destroy();
  });

  it('bar cells have proportional fill div', () => {
    const table = createTable(container, barSpec);

    const barFills = container.querySelectorAll('.viz-table-bar-fill');
    expect(barFills.length).toBe(3);

    // The bar values should have width proportional to their data
    const barValues = container.querySelectorAll('.viz-table-bar-value');
    expect(barValues.length).toBe(3);

    table.destroy();
  });

  it('destroy() removes DOM', () => {
    const table = createTable(container, makeSpec());

    const tableBefore = container.querySelector('table');
    expect(tableBefore).not.toBeNull();

    table.destroy();

    const tableAfter = container.querySelector('table');
    expect(tableAfter).toBeNull();
  });

  it('export("csv") returns valid CSV', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    const csv = table.export('csv');
    const lines = csv.split('\n');
    expect(lines.length).toBe(6); // 1 header + 5 data rows
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Age');
    expect(lines[0]).toContain('City');

    table.destroy();
  });

  it('search with no results renders "No results found" message', () => {
    vi.useFakeTimers();
    try {
      const spec = makeSpec({ search: true });
      const table = createTable(container, spec);

      // Search for something that doesn't match any data
      const input = container.querySelector('.viz-table-search input') as HTMLInputElement;
      input.value = 'zzzznonexistent';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Advance past the 200ms debounce
      vi.advanceTimersByTime(200);

      const empty = container.querySelector('.viz-table-empty');
      expect(empty).not.toBeNull();
      expect(empty?.textContent).toBe('No results found');

      table.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('controlled mode: externalState used, onStateChange fires', () => {
    const onStateChange = vi.fn();
    const spec = makeSpec();

    const table = createTable(container, spec, {
      externalState: { sort: null, search: '', page: 0 },
      onStateChange,
    });

    // Click sort
    const sortBtn = container.querySelector('[data-sort-column="age"]')!;
    sortBtn.dispatchEvent(new Event('click', { bubbles: true }));

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: { column: 'age', direction: 'asc' },
      }),
    );

    table.destroy();
  });

  it('update() re-renders with new spec', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    const headersBefore = container.querySelectorAll('thead th');
    expect(headersBefore.length).toBe(3);

    // Update with a spec that has 2 columns
    table.update({
      type: 'table',
      data: [{ x: 1, y: 2 }],
      columns: [
        { key: 'x', label: 'X' },
        { key: 'y', label: 'Y' },
      ],
    });

    const headersAfter = container.querySelectorAll('thead th');
    expect(headersAfter.length).toBe(2);

    table.destroy();
  });

  it('getState returns current state', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    const state = table.getState();
    expect(state.sort).toBeNull();
    expect(state.search).toBe('');
    expect(state.page).toBe(0);

    table.destroy();
  });

  it('setState updates table', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    table.setState({ sort: { column: 'age', direction: 'desc' } });

    const state = table.getState();
    expect(state.sort).toEqual({ column: 'age', direction: 'desc' });

    // First row should be the oldest (Charlie, 35)
    const firstRowCells = container.querySelectorAll('tbody tr:first-child td');
    expect(firstRowCells[0]?.textContent).toBe('Charlie');

    table.destroy();
  });

  it('compact mode applies viz-table--compact class', () => {
    const spec = makeSpec({ compact: true });
    const table = createTable(container, spec);

    const wrapper = container.querySelector('.viz-table-wrapper');
    expect(wrapper?.classList.contains('viz-table--compact')).toBe(true);

    table.destroy();
  });

  it('dark mode applies viz-dark class', () => {
    const spec = makeSpec();
    const table = createTable(container, spec, { darkMode: 'force' });

    expect(container.classList.contains('viz-dark')).toBe(true);

    table.destroy();
  });

  it('onRowClick makes rows clickable', () => {
    const onClick = vi.fn();
    const spec = makeSpec();
    const table = createTable(container, spec, { onRowClick: onClick });

    const wrapper = container.querySelector('.viz-table-wrapper');
    expect(wrapper?.classList.contains('viz-table--clickable')).toBe(true);

    // Click first row
    const firstRow = container.querySelector('tbody tr');
    firstRow?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ name: expect.any(String) }));

    table.destroy();
  });

  it('renders title chrome', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    const title = container.querySelector('.viz-table-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('People');

    table.destroy();
  });

  it('resize() re-renders the table', () => {
    const spec = makeSpec();
    const table = createTable(container, spec);

    // Should not throw
    table.resize();

    const tableEl = container.querySelector('table');
    expect(tableEl).not.toBeNull();

    table.destroy();
  });
});
