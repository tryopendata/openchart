import type { ChartSpec, MarkFocusEvent } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { createChart } from '../index';
import { renderStaticSVG } from '../static';

const rows = [
  { category: 'Same category', value: 10, panel: 'A', note: 'Authored A' },
  { category: 'Same category', value: 20, panel: 'B', note: 'Authored B' },
];
const base = {
  data: rows,
  animation: false,
  encoding: {
    x: { field: 'category', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
    facet: { field: 'panel', type: 'nominal' },
    description: { field: 'note', type: 'nominal' },
  },
};

describe('faceted mark association', () => {
  it.each([
    'bar',
    'line',
  ] as const)('%s keyboard and pointer inspection share the actual panel row', (mark) => {
    const host = document.createElement('div');
    document.body.append(host);
    const events: MarkFocusEvent[] = [];
    const chart = createChart(host, { ...base, mark } as ChartSpec, {
      autoResize: false,
      onMarkFocus: (event) => events.push(event),
    });
    try {
      // A one-observation line facet is rendered as its semantic point.
      const elements = [...host.querySelectorAll<SVGElement>('[data-mark-id]')];
      expect(elements).toHaveLength(2);
      expect(new Set(elements.map((element) => element.getAttribute('data-mark-id'))).size).toBe(2);
      for (const element of elements) {
        const id = element.getAttribute('data-mark-id')!;
        const content = chart.layout.tooltipDescriptors.get(id)!;
        expect(content).toBeDefined();
        const field = content.fields.find((field) => field.source?.field === 'value');
        expect(field?.value).toBe(
          element.closest('[data-facet]')?.getAttribute('data-facet') === 'A' ? '10' : '20',
        );
      }
      host.dispatchEvent(new FocusEvent('focus'));
      const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      host.dispatchEvent(arrow);
      expect(events).toHaveLength(2);
      expect(events[0].datum).toBe(rows[0]);
      expect(events[1].datum).toBe(rows[1]);
      expect(events[1]).toMatchObject({
        element: elements[1],
        description: rows[1].note,
        event: arrow,
      });
      expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('20');
      elements[0].dispatchEvent(new MouseEvent('mouseenter'));
      expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('10');
      elements[1].dispatchEvent(new MouseEvent('mouseenter'));
      expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('20');
      host.dispatchEvent(new FocusEvent('blur'));
      expect(events).toHaveLength(2);
    } finally {
      chart.destroy();
      host.remove();
    }
  });
});

it('keeps pooled indices across unequal panels and decorative line points', () => {
  const data = [rows[0], { ...rows[0], category: 'Next category', value: 15 }, rows[1]];
  const source = { ...base, data, mark: { type: 'line', point: 'last' } } as ChartSpec;
  const host = document.createElement('div');
  document.body.append(host);
  const events: MarkFocusEvent[] = [];
  const chart = createChart(host, source, {
    autoResize: false,
    onMarkFocus: (event) => events.push(event),
  });
  try {
    const marks = chart.layout.marks;
    expect(chart.layout.facet!.panels[0].marks.length).not.toBe(
      chart.layout.facet!.panels[1].marks.length,
    );
    expect(marks.some((mark) => mark.aria.decorative)).toBe(true);
    const elements = [...host.querySelectorAll<SVGElement>('[data-mark-id]')];
    expect(elements.map((element) => element.getAttribute('data-mark-id'))).toEqual(
      marks.map((mark, index) => `${mark.type}-${index}`),
    );
    const b = host.querySelector<SVGElement>('[data-facet="B"] [data-mark-id]')!;
    b.dispatchEvent(new MouseEvent('mouseenter'));
    expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('20');
    host.dispatchEvent(new FocusEvent('focus'));
    for (let i = 0; i < elements.length && events.at(-1)?.datum !== rows[1]; i++)
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(events.at(-1)?.datum).toBe(rows[1]);
    expect(events.at(-1)?.element).toBe(b);
    expect(events.at(-1)?.description).toBe(rows[1].note);
  } finally {
    chart.destroy();
    host.remove();
  }
});

it('static facet shapes carry their own identities and authored titles', () => {
  const svg = renderStaticSVG({ ...base, mark: 'bar' } as ChartSpec, { width: 700, height: 400 });
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  for (const row of rows) {
    const shape = document.querySelector(`[data-facet="${row.panel}"] [data-mark="bar"]`)!;
    expect(shape).not.toBeNull();
    expect(shape.getAttribute('data-category')).toBe(row.category);
    expect(shape.querySelector('title')?.textContent).toBe(row.note);
  }
});
