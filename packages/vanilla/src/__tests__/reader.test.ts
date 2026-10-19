import type { ChartSpec, LayerSpec, ReaderSelection } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { createReader } from '../reader';

const spec: ChartSpec = {
  mark: 'bar',
  animation: false,
  data: [
    { id: 'a', name: 'Alpha', value: 0 },
    { id: 'b', name: 'Beta', value: 80 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    x: { field: 'name', type: 'nominal', sort: null },
    y: { field: 'value', type: 'quantitative', scale: { domain: [0, 100] } },
  },
};
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const destroy of cleanup.splice(0).reverse()) destroy();
  document.body.innerHTML = '';
});

function mount(initial: ChartSpec | LayerSpec = spec) {
  const container = createContainer();
  const chart = createChart(container, initial);
  cleanup.push(() => chart.destroy());
  const changes: ReaderSelection[] = [];
  const reader = createReader(container, chart, initial, (selection) => changes.push(selection));
  cleanup.push(() => reader.destroy());
  const update = (next: ChartSpec | LayerSpec, visibleKeys?: ReadonlySet<string>) => {
    chart.update(next);
    reader.update(next, visibleKeys);
  };
  return { container, chart, reader, changes, update };
}

describe('reader identity and visibility on compiled charts', () => {
  it.each([
    'ArrowLeft',
    'ArrowUp',
  ])('starts backward navigation at the last observation (%s)', (key) => {
    const { container, reader } = mount();
    container.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect(reader.selection.preview?.datum).toBe(spec.data.at(-1));
  });

  it('retains a zero-value pin and marks it filtered when a transform hides its row', () => {
    const { reader, update } = mount();
    reader.pin(spec.data[0]);
    expect(reader.selection.pinned[0]).toMatchObject({ observation: 'string:a', state: 'visible' });

    update({ ...spec, transform: [{ filter: { field: 'id', equal: 'b' } }] });
    expect(reader.selection.pinned[0]).toMatchObject({
      observation: 'string:a',
      datum: spec.data[0],
      state: 'filtered',
    });

    update(spec);
    expect(reader.selection.pinned[0]).toMatchObject({ observation: 'string:a', state: 'visible' });
  });

  it('resolves transformed copies through unique typed source keys', () => {
    const mixed: ChartSpec = {
      ...spec,
      data: [
        { id: 1, name: 'Numeric', value: 10 },
        { id: '1', name: 'Text', value: 20 },
      ],
    };
    const { reader, update } = mount(mixed);
    reader.pin(mixed.data[0]);
    reader.pin(mixed.data[1]);
    update({
      ...mixed,
      transform: [
        { calculate: { op: '*', field: 'value', value: 2 }, as: 'doubled' },
        { filter: { field: 'name', equal: 'Text' } },
      ],
    });
    expect(
      reader.selection.pinned.map(({ observation, state }) => ({ observation, state })),
    ).toEqual([
      { observation: 'number:1', state: 'filtered' },
      { observation: 'string:1', state: 'visible' },
    ]);
  });

  it('preserves duplicate-key row identity within a revision and clears it on replacement', () => {
    const duplicate: ChartSpec = {
      ...spec,
      data: spec.data.map((row) => ({ ...row, id: 'same' })),
    };
    const { reader, update } = mount(duplicate);
    reader.pin(duplicate.data[1]);
    update({ ...duplicate, transform: [{ filter: { field: 'name', equal: 'Alpha' } }] });
    expect(reader.selection.pinned[0]).toMatchObject({
      datum: duplicate.data[1],
      persistent: false,
      state: 'filtered',
    });
    update(duplicate);
    expect(reader.selection.pinned[0]).toMatchObject({
      datum: duplicate.data[1],
      state: 'visible',
    });
    update({ ...duplicate, data: duplicate.data.map((row) => ({ ...row })) });
    expect(reader.selection.pinned).toEqual([]);
    expect(reader.selection.announcement).toContain('unique key');
  });

  it('does not bind an ambiguous copied row to the first duplicate observation', () => {
    const duplicate: ChartSpec = {
      ...spec,
      data: [spec.data[1], { ...spec.data[1] }],
    };
    const { reader } = mount(duplicate);
    reader.pin({ ...spec.data[1] });
    expect(reader.selection.pinned).toEqual([]);
  });

  it('keeps distinct identical rows available to keyboard inspection within their revision', () => {
    const duplicate: ChartSpec = { ...spec, data: [{ ...spec.data[1] }, { ...spec.data[1] }] };
    const { container, reader } = mount(duplicate);
    for (let i = 0; i < 2; i++) {
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    expect(reader.selection.pinned.map(({ observation }) => observation)).toEqual([
      'revision-row:0',
      'revision-row:1',
    ]);
  });

  it('refreshes series identity without losing a pinned row when the color field changes', () => {
    const grouped: ChartSpec = {
      ...spec,
      data: spec.data.map((row) => ({ ...row, group: 'Before', alternate: 'After' })),
      encoding: { ...spec.encoding, color: { field: 'group', type: 'nominal' } },
    };
    const { reader, update } = mount(grouped);
    reader.pin(grouped.data[1]);
    expect(reader.selection.pinned[0].series).toBe('string:Before');
    update({
      ...grouped,
      encoding: { ...grouped.encoding, color: { field: 'alternate', type: 'nominal' } },
    });
    expect(reader.selection.pinned[0]).toMatchObject({
      observation: 'string:b',
      series: 'string:After',
      state: 'visible',
    });
  });

  it('respects an explicit host visibility set and otherwise restores compiled visibility', () => {
    const { reader, update } = mount();
    reader.pin(spec.data[1]);
    update(spec, new Set(['string:a']));
    expect(reader.selection.pinned[0].state).toBe('filtered');
    update(spec);
    expect(reader.selection.pinned[0].state).toBe('visible');
  });

  it('uses destination visibility while a removed mark is still transitioning out', () => {
    const animated: ChartSpec = {
      ...spec,
      animation: { preset: 'fluid', enter: false },
      encoding: {
        ...spec.encoding,
        y: { field: 'value', type: 'quantitative', scale: { domain: [0, 100], clip: true } },
      },
    };
    const { chart, reader } = mount(animated);
    reader.pin(animated.data[1]);
    const filtered: ChartSpec = {
      ...animated,
      encoding: {
        ...animated.encoding,
        y: { field: 'value', type: 'quantitative', scale: { domain: [0, 50], clip: true } },
      },
    };
    const transition = chart.beginManualUpdate(filtered);
    expect(transition).not.toBeNull();
    transition!.step(50);
    reader.update(filtered);
    expect(reader.selection.pinned[0]).toMatchObject({
      observation: 'string:b',
      state: 'filtered',
    });
    transition!.cancel();
  });

  it('handles layers explicitly without choosing an arbitrary child dataset', () => {
    const layered: LayerSpec = { layer: [spec, { ...spec, mark: 'point' }] };
    const { container, reader, changes, update } = mount(layered);
    expect(changes.at(-1)?.announcement).toMatch(/layered charts/i);
    reader.pin(spec.data[1]);
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(reader.selection.pinned).toEqual([]);
    expect(reader.selection.preview).toBeNull();

    update(spec);
    reader.pin(spec.data[1]);
    expect(reader.selection.pinned[0].observation).toBe('string:b');
    update(layered);
    expect(reader.selection.pinned).toEqual([]);
    expect(reader.selection.announcement).toMatch(/layered charts/i);
  });
});
it('keeps the four-argument reader last-two-observations policy and silent controlled setters', () => {
  const third = { id: 'c', name: 'Gamma', value: 40 };
  const { reader, changes } = mount({ ...spec, data: [...spec.data, third] });
  reader.pin(spec.data[0]);
  reader.pin(spec.data[1]);
  reader.pin(third);
  expect(reader.selection.pinned.map((pin) => pin.datum.id)).toEqual(['b', 'c']);
  const count = changes.length;
  reader.setSelection({ ...reader.selection, pinned: [reader.selection.pinned[0]] });
  expect(changes).toHaveLength(count);
  reader.clear();
  expect(reader.selection.pinned).toHaveLength(0);
});

it('permits only the reader holding the actual chart navigation lease to handle keys', () => {
  const { container, chart, reader, changes } = mount();
  const secondChanges: ReaderSelection[] = [];
  const second = createReader(container, chart, spec, (state) => secondChanges.push(state));
  cleanup.push(() => second.destroy());
  container.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
  );
  expect(reader.selection.preview).not.toBeNull();
  expect(changes).toHaveLength(1);
  expect(secondChanges).toHaveLength(0);
  expect(second.selection.preview).toBeNull();
  reader.destroy();
  second.update(spec);
  const resumedCount = secondChanges.length;
  container.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
  );
  expect(secondChanges).toHaveLength(resumedCount + 1);
  expect(container.getAttribute('tabindex')).toBe('0');
});

it('keeps stable source identity while inspecting calculated destination values', () => {
  const transformed: ChartSpec = {
    ...spec,
    data: [{ id: 'a', name: 'Alpha', value: 10 }],
    transform: [{ calculate: { op: '*', field: 'value', value: 2 }, as: 'doubled' }],
    encoding: { ...spec.encoding, y: { field: 'doubled', type: 'quantitative' } },
  };
  const { container, reader } = mount(transformed);
  container.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
  );
  expect(reader.selection.preview?.datum.doubled).toBe(20);
  expect(reader.selection.preview?.persistent).toBe(true);
});

it('clears unkeyed pins on options-only source revision and keyed pins on binding replacement', () => {
  const unkeyed = { ...spec, encoding: { ...spec.encoding, key: undefined } };
  const { reader } = mount(unkeyed);
  reader.pin(unkeyed.data[0]);
  expect(reader.selection.pinned).toHaveLength(1);
  reader.setOptions({ revision: 'source-2' });
  expect(reader.selection.pinned).toHaveLength(0);
  const keyed = mount();
  keyed.reader.pin(spec.data[0]);
  keyed.reader.setOptions({ revision: 'source-2' });
  expect(keyed.reader.selection.pinned).toHaveLength(1);
  keyed.reader.setOptions({ revision: 'source-2', binding: { dataset: 'replacement' } });
  expect(keyed.reader.selection.pinned).toHaveLength(0);
});
