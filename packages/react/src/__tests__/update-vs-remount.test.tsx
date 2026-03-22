/**
 * Tests that spec changes go through the update() path rather than
 * destroying and recreating the chart/table instance.
 */

import type { ChartSpec, TableSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chart } from '../Chart';
import { DataTable } from '../DataTable';

// ---------------------------------------------------------------------------
// Mock the vanilla adapter to track create/update/destroy calls
// ---------------------------------------------------------------------------

const mockChartInstance = {
  update: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
  export: vi.fn(),
  layout: {} as unknown,
};

const mockTableInstance = {
  update: vi.fn(),
  setState: vi.fn(),
  destroy: vi.fn(),
  layout: {} as unknown,
};

vi.mock('@opendata-ai/openchart-vanilla', () => ({
  createChart: vi.fn(() => ({ ...mockChartInstance })),
  createTable: vi.fn(() => ({ ...mockTableInstance })),
  createGraph: vi.fn(),
}));

// Import after mock setup
const { createChart, createTable } = await import('@opendata-ai/openchart-vanilla');

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  mark: 'line',
  data: [
    { x: '2020', y: 10 },
    { x: '2021', y: 20 },
  ],
  encoding: {
    x: { field: 'x', type: 'temporal' },
    y: { field: 'y', type: 'quantitative' },
  },
};

const barSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
};

const tableSpec: TableSpec = {
  type: 'table',
  data: [{ a: 1 }],
  columns: [{ key: 'a', label: 'A' }],
};

const updatedTableSpec: TableSpec = {
  type: 'table',
  data: [{ a: 1 }, { a: 2 }],
  columns: [{ key: 'a', label: 'A' }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Chart update-vs-remount', () => {
  it('calls createChart once on initial mount', async () => {
    render(<Chart spec={lineSpec} />);
    await waitFor(() => {
      expect(createChart).toHaveBeenCalledTimes(1);
    });
  });

  it('calls update() not createChart() on spec change', async () => {
    const { rerender } = render(<Chart spec={lineSpec} />);
    await waitFor(() => {
      expect(createChart).toHaveBeenCalledTimes(1);
    });

    rerender(<Chart spec={barSpec} />);
    await waitFor(() => {
      // createChart should NOT be called again
      expect(createChart).toHaveBeenCalledTimes(1);
      // update should be called with the new spec
      expect(mockChartInstance.update).toHaveBeenCalledWith(barSpec);
    });
  });
});

describe('DataTable update-vs-remount', () => {
  it('calls createTable once on initial mount', async () => {
    render(<DataTable spec={tableSpec} />);
    await waitFor(() => {
      expect(createTable).toHaveBeenCalledTimes(1);
    });
  });

  it('calls update() not createTable() on spec change', async () => {
    const { rerender } = render(<DataTable spec={tableSpec} />);
    await waitFor(() => {
      expect(createTable).toHaveBeenCalledTimes(1);
    });

    rerender(<DataTable spec={updatedTableSpec} />);
    await waitFor(() => {
      expect(createTable).toHaveBeenCalledTimes(1);
      expect(mockTableInstance.update).toHaveBeenCalledWith(updatedTableSpec);
    });
  });
});
