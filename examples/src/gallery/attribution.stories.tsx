import type { Chrome } from '@opendata-ai/openchart-core';
import {
  BarList,
  Chart,
  DataTable,
  GeoMap,
  Graph,
  Sankey,
  TileMap,
} from '@opendata-ai/openchart-react';
import usStates from 'us-atlas/states-10m.json';

export default { title: 'Gallery / Attribution' };
const values = [
  { name: 'North', value: 42 },
  { name: 'South', value: 31 },
  { name: 'West', value: 17 },
];
function Matrix({ custom = false, large = false }: { custom?: boolean; large?: boolean }) {
  const chrome: Chrome = {
    source: {
      text: 'Source: County research office and administrative records, 2020–2025. Values are illustrative.',
      ...(large ? { style: { fontSize: 24 } } : {}),
    },
    byline: { text: 'Analysis: Open research team', ...(large ? { style: { fontSize: 24 } } : {}) },
    footer: 'Methods and coverage remain visible alongside the attribution.',
    ...(custom
      ? { brand: { text: 'Local research\nOpen methods', style: { fontSize: large ? 28 : 16 } } }
      : {}),
  };
  const card = { width: '100%', height: large ? 650 : 500 };
  return (
    <main style={{ padding: '56px 16px 16px', display: 'grid', gap: 32 }}>
      <section data-attribution-kind="chart">
        <Chart
          style={card}
          spec={{
            mark: 'bar',
            data: values,
            encoding: {
              y: { field: 'name', type: 'nominal' },
              x: { field: 'value', type: 'quantitative' },
            },
            chrome: { ...chrome, title: 'Chart attribution' },
            animation: false,
          }}
        />
      </section>
      <section data-attribution-kind="map">
        <GeoMap
          style={card}
          spec={{
            type: 'map',
            geo: { features: usStates, projection: 'albersUsa' },
            data: [{ id: '48', value: 31 }],
            encoding: {
              key: { field: 'id', type: 'nominal' },
              color: { field: 'value', type: 'quantitative' },
            },
            chrome: { ...chrome, title: 'Map attribution' },
            animation: false,
          }}
        />
      </section>
      <section data-attribution-kind="barlist">
        <BarList
          style={card}
          spec={{
            type: 'barlist',
            data: values,
            encoding: {
              label: { field: 'name', type: 'nominal' },
              value: { field: 'value', type: 'quantitative' },
            },
            chrome: { ...chrome, title: 'Bar list attribution' },
            animation: false,
          }}
        />
      </section>
      <section data-attribution-kind="sankey">
        <Sankey
          style={card}
          spec={{
            type: 'sankey',
            data: [{ from: 'Sources', to: 'Uses', value: 42 }],
            encoding: {
              source: { field: 'from', type: 'nominal' },
              target: { field: 'to', type: 'nominal' },
              value: { field: 'value', type: 'quantitative' },
            },
            chrome: { ...chrome, title: 'Flow attribution' },
            animation: false,
          }}
        />
      </section>
      <section data-attribution-kind="tilemap">
        <TileMap
          style={card}
          spec={{
            type: 'tilemap',
            data: { TX: 31, CA: 42, NY: 17 },
            chrome: { ...chrome, title: 'Tile map attribution' },
            animation: false,
          }}
        />
      </section>
      <section data-attribution-kind="table">
        <DataTable
          spec={{
            type: 'table',
            data: values,
            columns: [{ key: 'name' }, { key: 'value' }],
            chrome: { ...chrome, title: 'Table attribution' },
            animation: false,
          }}
        />
      </section>
      <section data-attribution-kind="graph">
        <Graph
          style={card}
          spec={{
            type: 'graph',
            nodes: [
              { id: 'a', label: 'Sources' },
              { id: 'b', label: 'Uses' },
            ],
            edges: [{ source: 'a', target: 'b' }],
            chrome: { ...chrome, title: 'Graph attribution' },
            animation: false,
            layout: { type: 'force', seed: 7 },
          }}
        />
      </section>
    </main>
  );
}
export const AllVisualizations = () => <Matrix />;
export const CustomBrand = () => <Matrix custom />;
export const LargeText = () => <Matrix custom large />;
