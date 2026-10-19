import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

const spec: ChartSpec = {
  mark: 'bar',
  animation: false,
  data: [
    { name: 'Alpha', value: 30 },
    { name: 'Beta', value: 80 },
  ],
  encoding: { y: { field: 'name', type: 'nominal' }, x: { field: 'value', type: 'quantitative' } },
  labels: { placement: 'column' },
};
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.innerHTML = '';
});
function mount(rowHover?: boolean) {
  const container = createContainer();
  const chart = createChart(container, spec, { rowHover });
  cleanup.push(() => chart.destroy());
  return { container, chart };
}
it('omission adds no row presentation', () => {
  const { container } = mount();
  expect(container.querySelector('.oc-row-hover')).toBeNull();
});
it('keyboard inspection paints the same logical bar and Escape clears it', () => {
  const { container, chart } = mount(true);
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const paint = container.querySelector('.oc-row-hover')!;
  expect(paint.getAttribute('display')).toBeNull();
  expect(chart.export('svg')).not.toContain('oc-row-hover');
  const mark = chart.layout.marks.find((mark) => mark.type === 'rect')!;
  const outline = paint.lastElementChild!;
  expect(outline.getAttribute('y')).toBe(String('y' in mark ? mark.y : ''));
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(paint.getAttribute('display')).toBe('none');
});
it('replaces its passive paint on update and removes it on destruction', () => {
  const { container, chart } = mount(true);
  expect(container.querySelectorAll('.oc-row-hover')).toHaveLength(1);
  chart.update({ ...spec, data: spec.data.slice(0, 1) });
  expect(container.querySelectorAll('.oc-row-hover')).toHaveLength(1);
  expect(container.querySelector('.oc-row-hover')?.getAttribute('pointer-events')).toBe('none');
  chart.destroy();
  expect(container.querySelector('.oc-row-hover')).toBeNull();
});
it('editor mode owns interaction and disables row paint', () => {
  const container = createContainer();
  const chart = createChart(container, spec, { rowHover: true, interaction: 'edit' });
  cleanup.push(() => chart.destroy());
  expect(container.querySelector('.oc-row-hover')).toBeNull();
});
it('inspects category and value zones without intercepting annotations, legends or controls', () => {
  const { container, chart } = mount(true);
  const svg = container.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: chart.layout.dimensions.width,
      height: chart.layout.dimensions.height,
    }) as DOMRect;
  const row = chart.layout.marks.find((mark) => mark.type === 'rect')!;
  const y = 'y' in row && 'height' in row ? row.y + row.height / 2 : 0;
  const move = (target: Element, x: number) =>
    target.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
  const paint = container.querySelector('.oc-row-hover')!;
  move(svg, 1);
  expect(paint.getAttribute('display')).toBeNull();
  move(svg, chart.layout.dimensions.width - 1);
  expect(paint.getAttribute('display')).toBeNull();
  for (const className of ['oc-annotations', 'oc-legend']) {
    const excluded = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    excluded.setAttribute('class', className);
    svg.append(excluded);
    move(excluded, 10);
    expect(paint.getAttribute('display')).toBe('none');
  }
  const button = document.createElement('button');
  container.append(button);
  move(button, 10);
  expect(paint.getAttribute('display')).toBe('none');
});
it('does not invent a single row for grouped bars', () => {
  const container = createContainer();
  const chart = createChart(
    container,
    {
      ...spec,
      data: [
        { name: 'Alpha', value: 3, group: 'one' },
        { name: 'Alpha', value: 7, group: 'two' },
      ],
      encoding: { ...spec.encoding, color: { field: 'group', type: 'nominal' } },
      labels: undefined,
    },
    { rowHover: true },
  );
  cleanup.push(() => chart.destroy());
  expect(container.querySelector('.oc-row-hover')).toBeNull();
});
it('clears cancelled pointers, ignores touch and yields to nested inputs', () => {
  const { container } = mount(true);
  const paint = container.querySelector('.oc-row-hover')!;
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(paint.getAttribute('display')).toBeNull();
  container.dispatchEvent(new Event('pointercancel', { bubbles: true }));
  expect(paint.getAttribute('display')).toBe('none');
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const touch = new MouseEvent('pointermove', { bubbles: true });
  Object.defineProperty(touch, 'pointerType', { value: 'touch' });
  container.dispatchEvent(touch);
  expect(paint.getAttribute('display')).toBe('none');
  const input = document.createElement('input');
  container.append(input);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(paint.getAttribute('display')).toBe('none');
});

it('caches pointer geometry and refreshes it on nested scroll and resize, then cleans up', () => {
  const { container, chart } = mount(true);
  const svg = container.querySelector('svg')!;
  const first = chart.layout.marks.find((mark) => mark.type === 'rect')!;
  if (first.type !== 'rect') throw new Error('Expected horizontal bar');
  let top = 0;
  let scale = 1;
  const bounds = vi.spyOn(svg, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        left: 0,
        top,
        width: chart.layout.dimensions.width * scale,
        height: chart.layout.dimensions.height * scale,
      }) as DOMRect,
  );
  const move = () =>
    svg.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: 10,
        clientY: top + (first.y + first.height / 2) * scale,
        bubbles: true,
      }),
    );
  const outline = container.querySelector('.oc-row-hover')!.lastElementChild!;
  move();
  move();
  move();
  expect(bounds).toHaveBeenCalledTimes(1);
  expect(outline.getAttribute('y')).toBe(String(first.y));
  top = 200;
  container.dispatchEvent(new Event('scroll'));
  move();
  move();
  expect(bounds).toHaveBeenCalledTimes(2);
  expect(outline.getAttribute('y')).toBe(String(first.y));
  scale = 0.5;
  window.dispatchEvent(new Event('resize'));
  move();
  move();
  expect(bounds).toHaveBeenCalledTimes(3);
  expect(outline.getAttribute('y')).toBe(String(first.y));
  chart.destroy();
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
  expect(bounds).toHaveBeenCalledTimes(3);
});

it('does not opt range-bar marks into simple bar row inspection', () => {
  const container = createContainer();
  const chart = createChart(
    container,
    {
      mark: { type: 'range', style: 'bar' },
      animation: false,
      data: [
        { name: 'Alpha', lo: 10, hi: 30 },
        { name: 'Beta', lo: 20, hi: 80 },
      ],
      encoding: {
        y: { field: 'name', type: 'nominal' },
        x: { field: 'lo', type: 'quantitative' },
        x2: { field: 'hi' },
      },
    },
    { rowHover: true },
  );
  cleanup.push(() => chart.destroy());
  expect(
    chart.layout.marks.some((mark) => mark.type === 'rect' && mark.orient === 'horizontal'),
  ).toBe(true);
  expect(container.querySelector('.oc-row-hover')).toBeNull();
});
