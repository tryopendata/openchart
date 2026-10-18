/**
 * Spec changes go through the vanilla update() path rather than destroying and
 * recreating the chart/table instance.
 *
 * These render the real vanilla adapter. An update is told apart from a
 * remount by state that only survives the former: the retained root SVG on a
 * compatible chart change, the entrance animation that only a fresh instance
 * plays, and the table's interactive sort state.
 */

import type { ChartSpec, EditTransaction, TableSpec } from '@opendata-ai/openchart-core';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chart } from '../Chart';
import { DataTable } from '../DataTable';

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
  chrome: { title: 'First' },
};

const updatedLineSpec: ChartSpec = {
  ...lineSpec,
  data: [
    { x: '2020', y: 10 },
    { x: '2021', y: 20 },
    { x: '2022', y: 40 },
  ],
  chrome: { title: 'Second' },
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

/** A draggable text annotation, so edit mode can emit a real transaction. */
const annotatedSpec: ChartSpec = {
  ...barSpec,
  annotations: [
    { type: 'text', x: 10, y: 'A', text: 'Peak', offset: { dx: 10, dy: -20 }, connector: true },
  ],
};

const tableSpec: TableSpec = {
  type: 'table',
  data: [{ a: 2 }, { a: 1 }],
  columns: [{ key: 'a', label: 'A' }],
};

const updatedTableSpec: TableSpec = {
  type: 'table',
  data: [{ a: 2 }, { a: 3 }, { a: 1 }],
  columns: [{ key: 'a', label: 'A' }],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rootSvg(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('.oc-chart-root > svg');
}

function dragAnnotation(container: HTMLElement): void {
  const annotation = container.querySelector('.oc-annotation-text');
  if (!annotation) throw new Error('annotation not rendered');
  fireEvent.mouseDown(annotation, { clientX: 100, clientY: 100 });
  fireEvent.mouseMove(document, { clientX: 150, clientY: 130 });
  fireEvent.mouseUp(document, { clientX: 150, clientY: 130 });
}

function annotationCursor(container: HTMLElement): string {
  return (container.querySelector('.oc-annotation-text') as SVGElement | null)?.style.cursor ?? '';
}

function cellValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tbody tr')].map(
    (row) => row.querySelector('td')?.textContent ?? '',
  );
}

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Chart update-vs-remount', () => {
  it('mounts a single chart on initial render', async () => {
    const { container } = render(<Chart spec={lineSpec} />);
    await waitFor(() => expect(rootSvg(container)).not.toBeNull());
    expect(container.querySelectorAll('.oc-chart-root > svg')).toHaveLength(1);
  });

  it('updates the mounted chart in place on a spec change', async () => {
    const { container, rerender } = render(<Chart spec={lineSpec} />);
    await waitFor(() => expect(rootSvg(container)).not.toBeNull());
    const svg = rootSvg(container);

    rerender(<Chart spec={updatedLineSpec} />);
    await waitFor(() => expect(container.querySelector('.oc-title')?.textContent).toBe('Second'));

    // A remount would have destroyed this node and built a new one.
    expect(rootSvg(container)).toBe(svg);
    expect(container.querySelectorAll('.oc-chart-root > svg')).toHaveLength(1);
  });

  it('does not replay the entrance when the mark type changes', async () => {
    const { container, rerender } = render(<Chart spec={{ ...lineSpec, animation: true }} />);
    await waitFor(() => expect(rootSvg(container)).not.toBeNull());
    // Only a freshly mounted chart plays its entrance.
    expect(rootSvg(container)?.classList.contains('oc-animate')).toBe(true);

    rerender(<Chart spec={{ ...barSpec, animation: true }} />);
    await waitFor(() => expect(container.querySelector('.oc-mark-rect')).not.toBeNull());

    expect(container.querySelectorAll('.oc-chart-root > svg')).toHaveLength(1);
    expect(rootSvg(container)?.classList.contains('oc-animate')).toBe(false);
  });
});

describe('DataTable update-vs-remount', () => {
  it('mounts a single table on initial render', async () => {
    const { container } = render(<DataTable spec={tableSpec} />);
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull());
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });

  it('updates the mounted table in place on a spec change, keeping its sort', async () => {
    const { container, rerender } = render(<DataTable spec={tableSpec} />);
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull());

    // Interactive sort lives on the instance; a remount would reset it.
    fireEvent.click(container.querySelector('[data-sort-column="a"]')!);
    await waitFor(() => expect(cellValues(container)).toEqual(['1', '2']));

    rerender(<DataTable spec={updatedTableSpec} />);
    await waitFor(() => expect(cellValues(container)).toEqual(['1', '2', '3']));
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });
});

describe('transaction wrapper options', () => {
  it('forwards transactions through a stable callback and updates revision without remounting', async () => {
    const first = vi.fn<(tx: EditTransaction) => void>();
    const second = vi.fn<(tx: EditTransaction) => void>();
    const { container, rerender } = render(
      <Chart spec={annotatedSpec} autoResize={false} revision="one" onEdit={first} />,
    );
    await waitFor(() => expect(container.querySelector('.oc-annotation-text')).not.toBeNull());
    const svg = rootSvg(container);

    dragAnnotation(container);
    expect(first).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0][0].revision).toBe('one');

    rerender(<Chart spec={annotatedSpec} autoResize={false} revision="two" onEdit={second} />);
    await waitFor(() => expect(container.querySelector('.oc-annotation-text')).not.toBeNull());
    // Swapping the handler and bumping the revision is an update, not a remount.
    expect(rootSvg(container)).toBe(svg);

    dragAnnotation(container);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0][0].revision).toBe('two');
  });
});

it('enables and disables a transaction callback added after mounting', async () => {
  const listener = vi.fn<(tx: EditTransaction) => void>();
  const { container, rerender } = render(<Chart spec={annotatedSpec} />);
  await waitFor(() => expect(container.querySelector('.oc-annotation-text')).not.toBeNull());
  // Without a listener the chart is read-only: the annotation isn't draggable.
  expect(annotationCursor(container)).not.toBe('grab');

  rerender(<Chart spec={annotatedSpec} onEdit={listener} />);
  await waitFor(() => expect(annotationCursor(container)).toBe('grab'));
  dragAnnotation(container);
  expect(listener).toHaveBeenCalledTimes(1);

  rerender(<Chart spec={annotatedSpec} />);
  await waitFor(() => expect(annotationCursor(container)).not.toBe('grab'));
  dragAnnotation(container);
  expect(listener).toHaveBeenCalledTimes(1);
});
