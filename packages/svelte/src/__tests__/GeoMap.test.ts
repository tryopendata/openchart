import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it } from 'vitest';
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
  const svg = result.container.querySelector('svg');
  await result.rerender({ spec, labelInventory: { container: second } });
  await waitFor(() => expect(second.querySelector('details')).not.toBeNull());
  expect(first.querySelector('details')).toBeNull();
  expect(result.container.querySelector('svg')).toBe(svg);
  expect(result.container.querySelectorAll('.oc-map-label-inventory')).toHaveLength(1);
  result.unmount();
  expect(second.querySelector('details')).toBeNull();
});
