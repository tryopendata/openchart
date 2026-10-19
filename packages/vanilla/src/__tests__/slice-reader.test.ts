import type {
  ChartSpec,
  ReaderChangeMeta,
  ReaderSliceSelection,
} from '@opendata-ai/openchart-core';
import { afterEach, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { createReader } from '../reader';

const spec: ChartSpec = {
  mark: 'line',
  animation: false,
  data: [
    { id: 'a', x: 1, y: 2, s: 'A' },
    { id: 'b', x: 2, y: 4, s: 'A' },
    { id: 'c', x: 3, y: 5, s: 'A' },
    { id: 'd', x: 1, y: 6, s: 'B' },
    { id: 'e', x: 3, y: 8, s: 'B' },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    x: { field: 'x', type: 'ordinal' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 's', type: 'nominal' },
  },
  fields: { y: { measure: 'sales', unit: 'USD', representation: 'number' } },
};
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0).reverse()) fn();
  document.body.innerHTML = '';
  vi.useRealTimers();
});
function mount(initial = spec) {
  const container = createContainer(),
    panel = document.createElement('aside');
  document.body.append(panel);
  const chart = createChart(container, initial, { autoResize: false });
  cleanup.push(() => chart.destroy());
  const changes: Array<{ state: ReaderSliceSelection; meta: ReaderChangeMeta }> = [];
  const reader = createReader(
    container,
    chart,
    initial,
    (state, meta) => changes.push({ state, meta }),
    { mode: 'slices', panel: { container: panel }, comparison: 'absolute' },
  );
  cleanup.push(() => reader.destroy());
  const key = (key: string) =>
    container.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  return { container, panel, chart, reader, changes, key };
}
it('opts into typed slices, preserves A on a third pin and promotes B when A is toggled off', () => {
  const { reader, key } = mount();
  key('ArrowRight');
  key('Enter');
  const a = reader.selection.pinned[0];
  key('ArrowRight');
  key('Enter');
  const b = reader.selection.pinned[1];
  key('ArrowRight');
  key('Enter');
  expect(reader.selection.pinned[0].key).toBe(a.key);
  expect(reader.selection.pinned[1].key).not.toBe(b.key);
  reader.pin(a);
  expect(reader.selection.pinned).toHaveLength(1);
  expect(reader.selection.pinned[0].x.value).toBe(3);
  expect(a.kind).toBe('slice');
  expect(a.x).toEqual({ kind: 'number', value: 1 });
});
it('shows absent observations, scoped facets and compatible date changes without invented deltas', () => {
  const { reader, key, panel } = mount();
  key('ArrowRight');
  key('Enter');
  key('ArrowRight');
  expect(panel.textContent).toContain('No observation');
  key('Enter');
  expect(panel.textContent).toContain('B minus A');
  expect(
    reader.selection.preview?.members.find((member) => member.series.label === 'B')?.status,
  ).toBe('no-observation');
});
it('reconciles automatically on a successful update and keeps pin identities on resize', () => {
  const { reader, key, chart } = mount();
  key('ArrowRight');
  key('Enter');
  const id = reader.selection.pinned[0].key;
  chart.resize();
  expect(reader.selection.pinned[0].key).toBe(id);
  chart.update({ ...spec, data: spec.data.map((row) => ({ ...row, y: Number(row.y) + 10 })) });
  expect(reader.selection.pinned[0].key).toBe(id);
  expect(reader.selection.pinned[0].members[0].value).toBe(12);
});
it('silently accepts controlled state and emits a programmatic reason only when requested', () => {
  const { reader, key, changes } = mount();
  key('ArrowRight');
  const desired = { ...reader.selection, pinned: [reader.selection.preview!] };
  const count = changes.length;
  reader.setSelection(desired);
  expect(changes).toHaveLength(count);
  reader.setSelection({ ...desired, pinned: [] }, { notify: true });
  expect(changes.at(-1)?.meta.reason).toBe('programmatic');
  reader.setSelection(reader.selection, { notify: true });
  expect(changes).toHaveLength(count + 1);
});
it('leases existing navigation and restores it on destroy, and yields to edit mode', () => {
  const { reader, container, key } = mount();
  key('ArrowRight');
  expect(container.querySelector('.oc-mark-focused')).toBeNull();
  expect(reader.selection.preview).not.toBeNull();
  reader.destroy();
  key('ArrowRight');
  expect(container.querySelector('[data-crosshair]')?.getAttribute('style') ?? '').not.toContain(
    'display: none',
  );
  const editor = createContainer();
  const chart = createChart(editor, spec, { interaction: 'edit' });
  cleanup.push(() => chart.destroy());
  const controlled = createReader(editor, chart, spec, () => {}, { mode: 'slices' });
  cleanup.push(() => controlled.destroy());
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(controlled.selection.preview).toBeNull();
});
it('keeps facet scopes separate while allowing both panels to be inspected', () => {
  const faceted: ChartSpec = {
    ...spec,
    data: spec.data.flatMap((row) => [
      { ...row, panel: 'East', id: `E${row.id}` },
      { ...row, panel: 'West', id: `W${row.id}` },
    ]),
    encoding: { ...spec.encoding, facet: { field: 'panel', type: 'nominal', columns: 2 } },
  };
  const { reader, key, panel } = mount(faceted);
  key('ArrowRight');
  key('Enter');
  const first = reader.selection.pinned[0];
  for (let i = 0; i < 3; i++) key('ArrowRight');
  key('Enter');
  expect(reader.selection.pinned[1].panel.id).not.toBe(first.panel.id);
  expect(panel.textContent).toContain('East');
  expect(panel.textContent).toContain('West');
  expect(panel.textContent).toMatch(/binding|panel/i);
});
it('cancels touch pins on pointercancel and does not read geometry for each pointer frame', () => {
  vi.useFakeTimers();
  const { container, reader, chart } = mount();
  const svg = container.querySelector('svg')!;
  const measurement = vi.spyOn(svg, 'getBoundingClientRect');
  const rect = container.getBoundingClientRect();
  const x = chart.layout.area.x + chart.layout.area.width / 2,
    y = chart.layout.area.y + 10;
  const pointer = (type: string) => {
    const event = new MouseEvent(type, {
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
    });
    Object.defineProperties(event, {
      pointerType: { value: 'touch' },
      pointerId: { value: 1 },
      isPrimary: { value: true },
    });
    container.dispatchEvent(event);
  };
  pointer('pointerdown');
  pointer('pointercancel');
  pointer('pointerup');
  expect(reader.selection.pinned).toHaveLength(0);
  expect(measurement).not.toHaveBeenCalled();
});
it('pins a stationary touch once and exposes settled announcements without a visible panel', () => {
  const container = createContainer();
  const chart = createChart(container, spec, { autoResize: false });
  cleanup.push(() => chart.destroy());
  const reader = createReader(container, chart, spec, () => {}, { mode: 'slices' });
  cleanup.push(() => reader.destroy());
  const x = chart.layout.area.x + chart.layout.area.width / 2,
    y = chart.layout.area.y + 10;
  const event = (type: string) => {
    const pointer = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperties(pointer, { pointerType: { value: 'touch' }, pointerId: { value: 1 } });
    container.dispatchEvent(pointer);
  };
  event('pointerdown');
  event('pointerup');
  expect(reader.selection.pinned).toHaveLength(1);
  container.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
  expect(reader.selection.pinned).toHaveLength(1);
  expect(container.querySelector('[aria-live=polite]')?.textContent).toMatch(/pinned as A/);
  reader.clear();
  expect(container.querySelector('[aria-live=polite]')?.textContent).toContain('dismissed');
});

it('clears unkeyed slices on options-only source revision and clears keyed slices on binding replacement', () => {
  const unkeyed = { ...spec, encoding: { ...spec.encoding, key: undefined } };
  const first = mount(unkeyed);
  first.key('ArrowRight');
  first.key('Enter');
  expect(first.reader.selection.pinned).toHaveLength(1);
  first.reader.setOptions({ mode: 'slices', revision: 'source-2' });
  expect(first.reader.selection.pinned).toHaveLength(0);
  const keyed = mount();
  keyed.key('ArrowRight');
  keyed.key('Enter');
  keyed.reader.setOptions({ mode: 'slices', revision: 'source-2' });
  expect(keyed.reader.selection.pinned).toHaveLength(1);
  keyed.reader.setOptions({
    mode: 'slices',
    revision: 'source-2',
    binding: { dataset: 'replacement' },
  });
  expect(keyed.reader.selection.pinned).toHaveLength(0);
});
