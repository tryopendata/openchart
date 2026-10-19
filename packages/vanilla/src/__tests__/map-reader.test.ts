import { buildGeoReaderIndex } from '@opendata-ai/openchart-engine';
import { afterEach, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createGeoMap } from '../map-mount';
import { createGeoReader } from '../map-reader';

const topology = {
  type: 'Topology',
  objects: {
    regions: {
      type: 'GeometryCollection',
      geometries: ['a', 'b', 'c'].map((id, index) => ({
        type: 'Polygon',
        id,
        properties: { name: `Region ${id}` },
        arcs: [[index]],
      })),
    },
  },
  arcs: [0, 15, 30].map((x) => [
    [x, 0],
    [x + 10, 0],
    [x + 10, 10],
    [x, 10],
    [x, 0],
  ]),
};
const base = {
  type: 'map' as const,
  geo: { features: topology, projection: 'identity' as const },
  data: [
    { id: 'a', v: 0 },
    { id: 'b', v: 5 },
    { id: 'c', v: 10 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' as const },
    color: { field: 'v', type: 'quantitative' as const },
  },
  animation: false as const,
};
afterEach(() => {
  document.body.innerHTML = '';
});
it('pins A/B without changing camera, retains A on a third pin, and updates automatically', () => {
  const container = createContainer();
  const map = createGeoMap(container, base, { autoResize: false });
  const changed = vi.fn();
  const reader = createGeoReader(container, map, base, changed);
  const refs = buildGeoReaderIndex(base, map.layout).records.map(
    (record) => record.observation.entity,
  );
  const camera = map.getCamera();
  for (const ref of refs) reader.pin(ref);
  expect(reader.selection.pinned.map((pin) => pin.entity.id)).toEqual(['a', 'c']);
  expect(map.getCamera()).toEqual(camera);
  const next = { ...base, data: base.data.map((row) => ({ ...row, v: row.v + 2 })) };
  map.update(next);
  expect(reader.selection.pinned[0].datum?.v).toBe(2);
  expect(reader.selection.pinned[0].previous?.v).toBe(0);
  const count = changed.mock.calls.length;
  reader.setSelection(reader.selection);
  reader.setOptions({});
  expect(changed).toHaveBeenCalledTimes(count);
  reader.destroy();
  map.destroy();
});
it('keeps unkeyed point pins during resize but clears them on data replacement', () => {
  const points = {
    data: [{ x: 5, y: 5, value: 10 }],
    longitude: { field: 'x' },
    latitude: { field: 'y' },
    size: { field: 'value', type: 'quantitative' as const },
  };
  const spec = { ...base, points };
  const container = createContainer();
  const map = createGeoMap(container, spec, { autoResize: false });
  const reader = createGeoReader(container, map, spec, vi.fn());
  const ref = buildGeoReaderIndex(spec, map.layout).records.at(-1)!.observation.entity;
  reader.pin(ref);
  expect(reader.selection.pinned[0].persistent).toBe(false);
  map.resize();
  expect(reader.selection.pinned).toHaveLength(1);
  map.update({ ...spec, points: { ...points, data: [...points.data] } });
  expect(reader.selection.pinned).toHaveLength(0);
  reader.destroy();
  map.destroy();
});
it('uses a separate keyboard inspection focus target and restores normal handlers on destroy', () => {
  const container = createContainer();
  const map = createGeoMap(container, base, { autoResize: false });
  const reader = createGeoReader(container, map, base, vi.fn());
  container
    .querySelector('svg')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(reader.selection.preview).toBeNull();
  const target = container.querySelector('.oc-map-inspect-places')!;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(reader.selection.preview?.entity.id).toBe('a');
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(reader.selection.pinned).toHaveLength(1);
  reader.destroy();
  expect(container.querySelector('.oc-map-inspect-places')).toBeNull();
  map.destroy();
});
it('rejects ambiguous pins but retains each duplicate as an inspectable record', () => {
  const points = {
    data: [
      { id: 1, x: 5, y: 5, v: 10 },
      { id: '1', x: 6, y: 5, v: 20 },
    ],
    key: { field: 'id' },
    longitude: { field: 'x' },
    latitude: { field: 'y' },
  };
  const spec = { ...base, points };
  const container = createContainer();
  const map = createGeoMap(container, spec, { autoResize: false });
  const reader = createGeoReader(container, map, spec, vi.fn());
  const index = buildGeoReaderIndex(spec, map.layout);
  const records = index.records.filter((record) => record.observation.entity.kind === 'point');
  expect(records).toHaveLength(2);
  reader.preview(records[0].observation.entity);
  expect(reader.selection.preview).not.toBeNull();
  reader.pin(records[0].observation.entity);
  expect(reader.selection.pinned).toHaveLength(0);
  reader.destroy();
  map.destroy();
});

it('retains unit metadata but never appends units to missing panel or companion values', () => {
  const spec = { ...base, fields: { v: { unit: '%' } }, data: [{ id: 'a', v: 0 }] };
  const container = createContainer(),
    panel = document.createElement('div'),
    list = document.createElement('div');
  document.body.append(panel, list);
  const map = createGeoMap(container, spec, { autoResize: false });
  const reader = createGeoReader(container, map, spec, vi.fn(), {
    panel: { container: panel },
    companion: { container: list },
  });
  const index = buildGeoReaderIndex(spec, map.layout);
  const missing = index.records.find((record) => record.observation.entity.id === 'b')!;
  expect(missing.unit).toBe('%');
  expect(missing.valueStatus).toBe('missing');
  reader.preview(missing.observation.entity);
  expect(panel.textContent).toContain('No data');
  expect(panel.textContent).not.toContain('No data %');
  expect(list.textContent).not.toContain('No data %');
  reader.destroy();
  map.destroy();
});

it('keeps keyboard preview through a layout-only resize before Enter pins B', () => {
  const container = createContainer(),
    map = createGeoMap(container, base, { autoResize: false });
  const reader = createGeoReader(container, map, base, vi.fn());
  const target = container.querySelector('.oc-map-inspect-places')!;
  const key = (key: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  key('ArrowRight');
  key('Enter');
  key('ArrowRight');
  expect(reader.selection.preview?.entity.id).toBe('b');
  map.resize();
  key('Enter');
  expect(reader.selection.pinned.map((pin) => pin.entity.id)).toEqual(['a', 'b']);
  reader.destroy();
  map.destroy();
  container.remove();
});

it('does not emit callbacks or recreate owned DOM after destruction', () => {
  const container = createContainer(),
    map = createGeoMap(container, base, { autoResize: false }),
    changed = vi.fn();
  const reader = createGeoReader(container, map, base, changed);
  const next = reader.selection;
  reader.destroy();
  const count = changed.mock.calls.length;
  const host = document.createElement('aside');
  reader.clear();
  reader.setSelection(next, { notify: true });
  reader.setOptions({ companion: { container: host }, panel: { container: host } });
  expect(changed).toHaveBeenCalledTimes(count);
  expect(host.children).toHaveLength(0);
  map.destroy();
  container.remove();
});
