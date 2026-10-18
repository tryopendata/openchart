import type { ChartSpec, EditTransaction } from '@opendata-ai/openchart-core';
import { applyEditTransaction } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

const spec: ChartSpec = {
  mark: 'point',
  animation: false,
  responsive: { autoThin: false },
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  annotations: [
    {
      type: 'text',
      id: 'a',
      x: 10,
      y: 5,
      text: 'Heading',
      subtitle: 'A wider subtitle',
      connector: 'curve',
    },
  ],
};
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function mount(controlled = false, initial: ChartSpec = spec) {
  let authored = initial;
  let width = 600;
  let height = 400;
  const container = document.createElement('div');
  document.body.append(container);
  container.getBoundingClientRect = () => ({
    width,
    height,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  });
  const transactions: EditTransaction[] = [];
  const chart = createChart(container, initial, {
    autoResize: false,
    interaction: 'edit',
    onEdit: (tx) => {
      transactions.push(tx);
      if (controlled) {
        const result = applyEditTransaction(authored, tx);
        if (!result.ok) throw new Error('fixture transaction failed');
        authored = result.spec;
        chart.update(authored);
      }
    },
    revision: 1,
  });
  cleanup.push(() => chart.destroy());
  const group = () => container.querySelector('.oc-annotation-text')!;
  const start = () => {
    group().dispatchEvent(createMouseEvent('mousedown', 100, 100));
    document.dispatchEvent(createMouseEvent('mousemove', 140, 120));
  };
  const end = () => document.dispatchEvent(createMouseEvent('mouseup', 140, 120));
  return {
    container,
    chart,
    transactions,
    group,
    start,
    end,
    setSize: (w: number, h: number) => {
      width = w;
      height = h;
    },
  };
}

describe('annotation gestures', () => {
  it('commits explicit anchor, offset and keep-inline as one transaction', () => {
    const m = mount();
    m.start();
    m.end();
    expect(m.transactions).toHaveLength(1);
    expect(m.transactions[0].ops.map((op) => op.path)).toEqual([
      '/annotations/0/anchor',
      '/annotations/0/offset',
      '/annotations/0/responsive',
    ]);
    const result = applyEditTransaction(spec, m.transactions[0]);
    expect(result.ok).toBe(true);
  });
  it.each([
    'Escape',
    'pointercancel',
    'touchcancel',
    'replace',
    'revision',
    'width',
  ])('%s cancels with no transaction', (path) => {
    const m = mount();
    m.start();
    if (path === 'Escape')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    else if (path === 'replace') m.chart.update(structuredClone(spec));
    else if (path === 'revision') m.chart.update(spec, { revision: 2 });
    else if (path === 'width') {
      m.setSize(500, 400);
      m.chart.resize();
    } else document.dispatchEvent(new Event(path));
    m.end();
    expect(m.transactions).toHaveLength(0);
  });
  it('a height-only resize keeps the drag active', () => {
    const m = mount();
    m.start();
    m.setSize(600, 430);
    m.chart.resize();
    m.end();
    expect(m.transactions).toHaveLength(1);
  });
  it('a no-op host leaves authored geometry after the keyboard batch commits', () => {
    vi.useFakeTimers();
    const m = mount();
    m.group().dispatchEvent(createMouseEvent('click'));
    const svg = m.container.querySelector('svg')!;
    const initial = m.group().querySelector('.oc-annotation-label')!.getAttribute('x');
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    svg.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
    expect(m.transactions).toHaveLength(0);
    vi.advanceTimersByTime(499);
    expect(m.transactions).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(m.transactions).toHaveLength(1);
    expect(m.group().querySelector('.oc-annotation-label')!.getAttribute('x')).toBe(initial);
  });
  it('starts a drag after a pending nudge synchronously updates the host', () => {
    const m = mount(true);
    m.group().dispatchEvent(createMouseEvent('click'));
    m.container.querySelector('svg')!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',

        bubbles: true,
      }),
    );
    m.start();
    m.end();
    expect(m.transactions).toHaveLength(2);
  });
  it('resize retains a pending nudge committed synchronously by the host', () => {
    const m = mount(true);
    m.group().dispatchEvent(createMouseEvent('click'));
    const initial = m.chart.layout.annotations[0].label!.x;
    m.container.querySelector('svg')!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',

        bubbles: true,
      }),
    );
    m.chart.resize();
    expect(m.transactions).toHaveLength(1);
    expect(m.chart.layout.annotations[0].label!.x).toBeCloseTo(initial - 1);
  });
  it('arrows nudge and flush before Escape', () => {
    const m = mount();
    m.group().dispatchEvent(createMouseEvent('click'));
    const svg = m.container.querySelector('svg')!;
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    svg.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',

        shiftKey: true,
        bubbles: true,
      }),
    );
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(m.transactions).toHaveLength(1);
    expect(m.transactions[0].ops.find((op) => op.path.endsWith('/responsive'))).toMatchObject({
      value: false,
    });
  });
});

it('nudges by one pixel or ten with Shift, while Tab cycles selection', () => {
  const m = mount(true);
  m.group().dispatchEvent(createMouseEvent('click'));
  const original = m.chart.layout.annotations[0].label!;
  const before = { x: original.x, y: original.y };
  const svg = m.container.querySelector('svg')!;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  svg.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
  );
  expect(m.transactions).toHaveLength(0);
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  expect(m.transactions).toHaveLength(1);
  expect(m.chart.layout.annotations[0].label!.x).toBeCloseTo(before.x - 1);
  expect(m.chart.layout.annotations[0].label!.y).toBeCloseTo(before.y + 10);
});

it('batches successive key releases for 500ms and leaves modified/native key combinations alone', () => {
  vi.useFakeTimers();
  const m = mount();
  m.group().dispatchEvent(createMouseEvent('click'));
  const svg = m.container.querySelector('svg')!;
  for (const modifier of ['altKey', 'metaKey', 'ctrlKey']) {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      [modifier]: true,
      bubbles: true,
      cancelable: true,
    });
    svg.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(m.transactions).toHaveLength(0);
  for (let index = 0; index < 2; index++) {
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    svg.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
    vi.advanceTimersByTime(400);
    expect(m.transactions).toHaveLength(0);
  }
  vi.advanceTimersByTime(100);
  expect(m.transactions).toHaveLength(1);
});

it('an animated async host update does not tween a released drag back from its origin', async () => {
  vi.useFakeTimers();
  let authored: ChartSpec = { ...spec, animation: true };
  const container = document.createElement('div');
  document.body.append(container);
  container.getBoundingClientRect = () =>
    ({ width: 600, height: 400, x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400 }) as DOMRect;
  const chart = createChart(container, authored, {
    autoResize: false,
    onEdit: (tx) => {
      const result = applyEditTransaction(authored, tx);
      if (!result.ok) throw new Error('fixture transaction failed');
      authored = result.spec;
      queueMicrotask(() => chart.update(authored));
    },
  });
  cleanup.push(() => chart.destroy());
  vi.advanceTimersByTime(5000);
  const group = () => container.querySelector('.oc-annotation-text')!;
  const labelPosition = () => {
    const label = group().querySelector('.oc-annotation-label')!;
    return [label.getAttribute('x'), Number(label.getAttribute('y')).toFixed(3)];
  };
  const origin = labelPosition();
  group().dispatchEvent(createMouseEvent('mousedown', 100, 100));
  document.dispatchEvent(createMouseEvent('mousemove', 140, 120));
  vi.advanceTimersByTime(20);
  const previewed = labelPosition();
  expect(previewed).not.toEqual(origin);
  document.dispatchEvent(createMouseEvent('mouseup', 140, 120));
  await Promise.resolve();
  vi.advanceTimersByTime(20);
  expect(labelPosition()).toEqual(previewed);
});

it('commits a pending nudge when focus leaves before the key is released', () => {
  const m = mount();
  m.group().dispatchEvent(createMouseEvent('click'));
  const svg = m.container.querySelector('svg')!;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(m.transactions).toHaveLength(0);
  window.dispatchEvent(new Event('blur'));
  expect(m.transactions).toHaveLength(1);
});

it('flushes a pending nudge before opening the text editor', () => {
  const m = mount(true);
  m.group().dispatchEvent(createMouseEvent('click'));
  const svg = m.container.querySelector('svg')!;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(m.transactions).toHaveLength(1);
  expect(m.container.querySelector('textarea, input, [contenteditable]')).not.toBeNull();
});

it('keeps the clicked text node connected through an unmoved pointer gesture', () => {
  const m = mount();
  const text = m.group().querySelector('.oc-annotation-label')!;
  const line = text.firstChild!;
  text.dispatchEvent(createMouseEvent('mousedown', 100, 100));
  document.dispatchEvent(createMouseEvent('mouseup', 100, 100));
  expect(line.isConnected).toBe(true);
  expect(text.firstChild).toBe(line);
  expect(m.transactions).toHaveLength(0);
});
