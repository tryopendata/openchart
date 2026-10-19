import type { GeoMapSpec } from '@opendata-ai/openchart-core';
export const geoLabelSpec: GeoMapSpec = {
  type: 'map',
  animation: false,
  geo: {
    projection: 'identity',
    zoom: true,
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
  data: [{ id: 'a', name: 'Exact custom region', value: 4 }],
  encoding: {
    color: { field: 'value', type: 'quantitative' },
    key: { field: 'id', type: 'nominal' },
    text: { field: 'name', type: 'nominal' },
  },
  callouts: [
    {
      id: 'coordinate',
      anchor: { kind: 'coordinate', space: 'source', x: 50, y: 50 },
      text: 'Authored coordinate text',
      subtitle: 'Complete subtitle',
      minZoom: 2,
    },
  ],
};
