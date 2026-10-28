import type { ChartSpec, MarkFocusEvent } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { createChart } from '../index';

const rows = [
  { name: 'A', value: 10, series: 'First', note: 'First authored description' },
  { name: 'B', value: 20, series: 'Second', note: 'Second authored description' },
];
const spec: ChartSpec = {
  mark: 'bar',
  data: rows,
  animation: false,
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
    color: { field: 'series', type: 'nominal' },
    description: { field: 'note', type: 'nominal' },
  },
};

describe('host mark focus', () => {
  it('omits only the table and reports first focus and changed marks with original events', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const events: MarkFocusEvent[] = [];
    const chart = createChart(
      host,
      { ...spec, a11y: { table: false } },
      { autoResize: false, onMarkFocus: (event) => events.push(event) },
    );
    try {
      expect(host.querySelector('table')).toBeNull();
      expect(host.getAttribute('tabindex')).toBe('0');
      const first = new FocusEvent('focus');
      host.dispatchEvent(first);
      const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      host.dispatchEvent(right);
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ datum: rows[0], series: 'First', event: first });
      expect(events[1]).toMatchObject({ datum: rows[1], series: 'Second', event: right });
      expect(events[0].datum).toBe(rows[0]);
      expect(events[1].description).toBe(rows[1].note);
      expect(events[0].key).not.toBe(events[1].key);
      for (const event of events) {
        expect(event.element.classList.contains('oc-mark-focused') || event === events[0]).toBe(
          true,
        );
        expect(event.description).toBe(event.element.getAttribute('aria-label'));
      }
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      host.dispatchEvent(new FocusEvent('blur'));
      expect(events).toHaveLength(2);
      expect(host.querySelector('.oc-mark-focused')).toBeNull();
      chart.update(spec);
      expect(host.querySelector('table')).not.toBeNull();
      chart.update({ ...spec, a11y: { hidden: true } });
      expect(host.querySelector('table')).toBeNull();
      expect(host.hasAttribute('tabindex')).toBe(false);
    } finally {
      chart.destroy();
      host.remove();
    }
  });

  it('line focus cycles series at the current observation', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const events: MarkFocusEvent[] = [];
    const data = ['First', 'Second'].flatMap((series) => [
      { year: '2020', value: 10, series },
      { year: '2021', value: 15, series },
    ]);
    const chart = createChart(
      host,
      {
        mark: 'line',
        data,
        animation: false,
        encoding: {
          x: { field: 'year', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      },
      { autoResize: false, onMarkFocus: (event) => events.push(event) },
    );
    try {
      host.dispatchEvent(new FocusEvent('focus'));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(events.map((event) => event.series)).toEqual(['First', 'Second']);
      expect(events.map((event) => event.datum)).toEqual([data[0], data[2]]);
    } finally {
      chart.destroy();
      host.remove();
    }
  });

  it.each([
    'line',
    'area',
  ] as const)('%s focus follows observed rows through the crosshair', (mark) => {
    const host = document.createElement('div');
    const events: MarkFocusEvent[] = [];
    document.body.append(host);
    const data = [
      { year: '2020', value: 10 },
      { year: '2021', value: 15 },
    ];
    const chart = createChart(
      host,
      {
        mark,
        data,
        animation: false,
        encoding: {
          x: { field: 'year', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      { autoResize: false, onMarkFocus: (event) => events.push(event) },
    );
    try {
      host.dispatchEvent(new FocusEvent('focus'));
      const right = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      host.dispatchEvent(right);
      expect(events.map((event) => event.datum)).toEqual(data);
      expect(events[1].event).toBe(right);
      expect(events[0].key).not.toBe(events[1].key);
      host.dispatchEvent(new FocusEvent('blur'));
      expect(events).toHaveLength(2);
    } finally {
      chart.destroy();
      host.remove();
    }
  });
});
