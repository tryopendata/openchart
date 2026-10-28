import type { ChartSpec, LayerSpec, MarkFocusEvent } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../index';

const data = [1, 2, null, 5, null, 7, 8].map((value, index) => ({
  date: `2026-01-0${index + 1}`,
  value,
  note: `observation-${index + 1}`,
}));
const encoding = {
  x: { field: 'date', type: 'temporal' },
  y: { field: 'value', type: 'quantitative' },
  description: { field: 'note', type: 'nominal' },
  tooltip: [
    { field: 'note', type: 'nominal' },
    { field: 'value', type: 'quantitative' },
  ],
} as const;

function setSvgBounds(host: HTMLElement): SVGElement {
  const svg = host.querySelector('svg')!;
  Object.defineProperty(svg, 'getBoundingClientRect', {
    value: () => host.getBoundingClientRect(),
  });
  return svg;
}

describe('mixed connected and isolated observations', () => {
  it.each([
    'line',
    'area',
  ] as const)('%s keeps every valid row available to pointer and keyboard', (mark) => {
    const host = createContainer();
    const focused: MarkFocusEvent[] = [];
    const chart = createChart(host, { mark, data, encoding, animation: false } as ChartSpec, {
      autoResize: false,
      onMarkFocus: (event) => focused.push(event),
    });
    try {
      const svg = setSvgBounds(host);
      const overlay = svg.querySelector('[data-voronoi-overlay]')!;
      expect(overlay).not.toBeNull();
      const isolated = chart.layout.marks.find(
        (shape) => shape.type === 'point' && shape.data === data[3],
      )!;
      expect(isolated.type).toBe('point');
      const isolatedElement = host.querySelector<SVGElement>(
        `[data-mark-id="point-${chart.layout.marks.indexOf(isolated)}"]`,
      )!;
      expect(isolatedElement.getAttribute('data-mark')).toBe('point');
      const valid = data.filter((row) => row.value !== null);
      for (const row of valid) {
        const point = chart.layout.marks
          .flatMap((shape) =>
            shape.type === 'line' || shape.type === 'area'
              ? (shape.dataPoints ?? [])
              : shape.type === 'point'
                ? [{ x: shape.cx, y: shape.cy, datum: shape.data }]
                : [],
          )
          .find((point) => point.datum === row)!;
        overlay.dispatchEvent(createMouseEvent('mousemove', point.x, point.y));
        expect(host.querySelector('[role="tooltip"]')?.textContent).toContain(row.note);
      }
      host.dispatchEvent(new FocusEvent('focus'));
      for (let i = 1; i < valid.length; i++)
        host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(focused.map((event) => event.datum)).toEqual(valid);
      expect(focused[2].element).toBe(isolatedElement);
      expect(focused[2].description).toBe(data[3].note);
      expect(focused.slice(1).every((event) => event.event instanceof KeyboardEvent)).toBe(true);
      expect(host.querySelector('[role="tooltip"]')?.textContent).toContain(valid.at(-1)!.note);
    } finally {
      chart.destroy();
      host.remove();
    }
  });

  it.each([
    'line',
    'area',
  ] as const)('%s retains the series identity of an isolated point', (mark) => {
    const host = createContainer();
    const rows = data.map((row) => ({ ...row, series: 'A' }));
    const focused: MarkFocusEvent[] = [];
    const chart = createChart(
      host,
      {
        mark,
        data: rows,
        encoding: { ...encoding, color: { field: 'series', type: 'nominal' } },
        animation: false,
      } as ChartSpec,
      { autoResize: false, onMarkFocus: (event) => focused.push(event) },
    );
    try {
      host.dispatchEvent(new FocusEvent('focus'));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(focused.at(-1)?.datum).toBe(rows[3]);
      expect(focused.every((event) => event.series === 'A')).toBe(true);
    } finally {
      chart.destroy();
      host.remove();
    }
  });

  it('announces a changed data mark even when another layer shares its row object', () => {
    const host = createContainer();
    const rows = [
      { date: '2026-01-01', value: 1 },
      { date: '2026-01-02', value: 2 },
    ];
    const focused: MarkFocusEvent[] = [];
    const positions = {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    } as const;
    const chart = createChart(
      host,
      {
        layer: [
          {
            mark: 'line',
            data: rows,
            encoding: { ...positions, description: { value: 'Trend' } },
            animation: false,
          },
          {
            mark: 'point',
            data: rows,
            encoding: { ...positions, description: { value: 'Row' } },
            animation: false,
          },
        ],
      } as LayerSpec,
      { autoResize: false, onMarkFocus: (event) => focused.push(event) },
    );
    try {
      host.dispatchEvent(new FocusEvent('focus'));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(focused).toHaveLength(2);
      expect(focused[0].datum).toBe(rows[0]);
      expect(focused[1].datum).toBe(rows[0]);
      expect(focused[0].element).not.toBe(focused[1].element);
      expect(focused[0].key).not.toBe(focused[1].key);
      expect(focused.map((event) => event.description)).toEqual(['Trend', 'Row']);
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(focused).toHaveLength(2);
    } finally {
      chart.destroy();
      host.remove();
    }
  });

  it('deduplicates visible connected markers without adding series styling metadata', () => {
    const host = createContainer();
    const rows = data.map((row) => ({ ...row, series: 'A' }));
    const focused: MarkFocusEvent[] = [];
    const chart = createChart(
      host,
      {
        mark: { type: 'line', point: true },
        data: rows,
        encoding: { ...encoding, color: { field: 'series', type: 'nominal' } },
        animation: false,
      } as ChartSpec,
      { autoResize: false, onMarkFocus: (event) => focused.push(event) },
    );
    try {
      const connected = chart.layout.marks.find(
        (mark) => mark.type === 'point' && mark.data === rows[0],
      );
      expect(connected).not.toHaveProperty('seriesKey');
      host.dispatchEvent(new FocusEvent('focus'));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(focused).toHaveLength(1);
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(focused.at(-1)?.datum).toBe(rows[3]);
      expect(focused.every((event) => event.series === 'A')).toBe(true);
    } finally {
      chart.destroy();
      host.remove();
    }
  });

  it('retains layered point evidence at the same date as an isolated trend observation', () => {
    const host = createContainer();
    const focused: MarkFocusEvent[] = [];
    const extra = { date: data[3].date, value: 12, note: 'authored-point-layer' };
    const spec: LayerSpec = {
      layer: [
        { mark: 'line', data, encoding, animation: false },
        { mark: 'point', data: [extra], encoding, animation: false },
      ],
    } as LayerSpec;
    const chart = createChart(host, spec, {
      autoResize: false,
      onMarkFocus: (event) => focused.push(event),
    });
    try {
      const svg = setSvgBounds(host);
      const point = chart.layout.marks.find(
        (shape) => shape.type === 'point' && shape.data === extra,
      )!;
      if (point.type !== 'point') throw Error();
      svg
        .querySelector('[data-voronoi-overlay]')!
        .dispatchEvent(createMouseEvent('mousemove', point.cx, point.cy));
      expect(host.querySelector('[role="tooltip"]')?.textContent).toContain(extra.note);
      expect(host.querySelector('[role="tooltip"]')?.textContent).toContain(data[3].note);
      host.dispatchEvent(new FocusEvent('focus'));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(focused.at(-1)?.datum).toBe(data[3]);
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(focused.at(-1)?.datum).toBe(extra);
    } finally {
      chart.destroy();
      host.remove();
    }
  });
});
