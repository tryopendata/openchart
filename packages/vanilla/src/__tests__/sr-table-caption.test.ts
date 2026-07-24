import type { ChartLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { createScreenReaderTable } from '../interactions/selection';

/** Minimal layout carrying only the a11y fields createScreenReaderTable reads. */
function layoutWith(a11y: Partial<ChartLayout['a11y']>): ChartLayout {
  return {
    a11y: {
      altText: 'Scatter chart',
      dataTableFallback: [
        ['x', 'y'],
        [1, 2],
        [3, 4],
      ],
      role: 'img',
      keyboardNavigable: true,
      ...a11y,
    },
  } as ChartLayout;
}

describe('createScreenReaderTable caption', () => {
  it('names the true total when the table was truncated', () => {
    const container = document.createElement('div');
    const table = createScreenReaderTable(layoutWith({ totalRows: 50_000 }), container);

    const caption = table?.querySelector('caption');
    expect(caption?.textContent).toBe('Showing first 2 of 50,000 rows; full data via CSV export');
  });

  it('formats the cap with thousands separators', () => {
    const container = document.createElement('div');
    const layout = layoutWith({
      dataTableFallback: [['x'], ...Array.from({ length: 1000 }, (_, i) => [i])],
      totalRows: 12_345,
    });
    const table = createScreenReaderTable(layout, container);

    expect(table?.querySelector('caption')?.textContent).toBe(
      'Showing first 1,000 of 12,345 rows; full data via CSV export',
    );
  });

  it('renders no caption when the table was not truncated', () => {
    const container = document.createElement('div');
    const table = createScreenReaderTable(layoutWith({}), container);

    expect(table?.querySelector('caption')).toBeNull();
  });
});
