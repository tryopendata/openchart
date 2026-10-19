import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import GeoMap from '../GeoMap.svelte';

afterEach(cleanup);
it('forwards and replaces inventory hosts without replacing the SVG', async () => {
  const spec: GeoMapSpec = {
    type: 'map',
    animation: false,
    geo: {
      projection: 'identity',
      features: {
        type: 'Topology',
        objects: {
          regions: {
            type: 'GeometryCollection',
            geometries: [{ type: 'Polygon', id: 'a', properties: {}, arcs: [[0]] }],
          },
        },
        arcs: [
          [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
            [0, 0],
          ],
        ],
      },
    },
    data: [{ id: 'a', value: 3 }],
    encoding: {
      key: { field: 'id', type: 'nominal' },
      color: { field: 'value', type: 'quantitative' },
    },
    callouts: [
      {
        id: 'note',
        anchor: { kind: 'coordinate', space: 'source', x: 50, y: 50 },
        text: 'Exact custom text',
        minZoom: 2,
      },
    ],
  };
  const first = document.createElement('aside'),
    second = document.createElement('aside');
  const result = render(GeoMap, { props: { spec, labelInventory: { container: first } } });
  await waitFor(() => expect(first.querySelector('details')).not.toBeNull());
  const instance = result.component.getInstance();
  expect(instance?.getCameras().root).toEqual(instance?.getCamera());
  const svg = result.container.querySelector('svg');
  await result.rerender({ spec, labelInventory: { container: second } });
  await waitFor(() => expect(second.querySelector('details')).not.toBeNull());
  expect(first.querySelector('details')).toBeNull();
  expect(result.container.querySelector('svg')).toBe(svg);
  expect(result.container.querySelectorAll('.oc-map-label-inventory')).toHaveLength(1);
  result.unmount();
  expect(second.querySelector('details')).toBeNull();
  expect(result.component.getInstance()).toBeNull();
});

const readerMapSpec: GeoMapSpec = {
  type: 'map',
  animation: false,
  geo: {
    projection: 'identity',
    features: {
      type: 'Topology',
      objects: {
        regions: {
          type: 'GeometryCollection',
          geometries: [{ type: 'Polygon', id: 'a', properties: {}, arcs: [[0]] }],
        },
      },
      arcs: [
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
      ],
    },
  },
  data: [{ id: 'a', value: 3 }],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'value', type: 'quantitative' },
  },
  callouts: [
    {
      id: 'note',
      anchor: { kind: 'coordinate', space: 'source', x: 50, y: 50 },
      text: 'Exact custom text',
      minZoom: 2,
    },
  ],
};
it('keeps map reader pins through host and callback replacement without controlled echo', async () => {
  const first = document.createElement('aside'),
    second = document.createElement('aside'),
    before = vi.fn(),
    after = vi.fn();
  const result = render(GeoMap, {
    props: { spec: readerMapSpec, reader: { panel: { container: first } }, onreaderchange: before },
  });
  await waitFor(() => expect(first.querySelector('.oc-reader-panel')).not.toBeNull());
  const root = result.container.querySelector('.oc-map-inspect-places')!;
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const state = before.mock.calls.at(
    -1,
  )![0] as import('@opendata-ai/openchart-core').GeoReaderSelection;
  expect(state.pinned).toHaveLength(1);
  const svg = result.container.querySelector('svg');
  await result.rerender({
    spec: readerMapSpec,
    reader: { panel: { container: second } },
    readerSelection: state,
    onreaderchange: after,
  });
  expect(result.container.querySelector('svg')).toBe(svg);
  expect(after).not.toHaveBeenCalled();
  expect(first.querySelector('.oc-reader-panel')).toBeNull();
  expect(second.textContent).toContain('A:');
  result.unmount();
  expect(second.querySelector('.oc-reader-panel')).toBeNull();
});

it('forwards scoped camera metadata through getInstance and cleans up the handle', async () => {
  const changed = vi.fn();
  const spec: GeoMapSpec = {
    ...readerMapSpec,
    geo: {
      ...readerMapSpec.geo,
      insets: [
        {
          id: 'copy',
          label: 'Copy',
          featureIds: ['a'],
          placement: 'bottom-left',
          width: 120,
          removeFromMain: false,
        },
      ],
    },
  };
  const result = render(GeoMap, { props: { spec, oncamerachange: changed } });
  await waitFor(() => expect(result.component.getInstance()?.getCameras().copy).toBeDefined());
  const instance = result.component.getInstance()!;
  const camera = { ...instance.getCamera('copy'), k: 2 };
  instance.setCamera(camera, { viewId: 'copy' });
  expect(changed).toHaveBeenLastCalledWith(camera, { viewId: 'copy' });
  result.unmount();
  expect(result.component.getInstance()).toBeNull();
});
