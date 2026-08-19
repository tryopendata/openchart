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

describe('createScreenReaderTable hiding', () => {
  /**
   * The hiding must sit on a wrapper div, never on the table. width/height are
   * minimums on a table box, so a 1x1 table stays full size and its absolutely
   * positioned bulk inflates the host page's scroll container. No layout engine
   * here to measure that, so assert the structure that prevents it.
   */
  it('hides via a wrapper div and leaves the table unsized', () => {
    const container = document.createElement('div');
    const wrapper = createScreenReaderTable(layoutWith({}), container);

    expect(wrapper?.tagName).toBe('DIV');
    expect(wrapper?.classList.contains('oc-sr-only')).toBe(true);
    expect(wrapper?.style.position).toBe('absolute');
    expect(wrapper?.style.width).toBe('1px');
    expect(wrapper?.style.height).toBe('1px');
    expect(container.firstElementChild).toBe(wrapper);

    const table = wrapper?.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.classList.contains('oc-sr-only')).toBe(false);
    expect(table?.style.width).toBe('');
    expect(table?.style.height).toBe('');
    expect(table?.style.position).toBe('');
  });

  it('keeps the table exposed to assistive technology', () => {
    const container = document.createElement('div');
    const table = createScreenReaderTable(layoutWith({}), container)?.querySelector('table');

    expect(table?.getAttribute('role')).toBe('table');
    expect(table?.getAttribute('aria-label')).toBe('Data table: Scatter chart');
    expect(table?.querySelectorAll('th[scope="col"]')).toHaveLength(2);
  });

  it('never scrolls, so it cannot become a keyboard tab stop', () => {
    const container = document.createElement('div');
    const wrapper = createScreenReaderTable(layoutWith({}), container);

    expect(wrapper?.style.overflow).toBe('clip');
  });
});
