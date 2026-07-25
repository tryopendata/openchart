import type {
  BarListSpec,
  ChartSpec,
  GraphSpec,
  SankeySpec,
  TableSpec,
  TileMapSpec,
  VizSpec,
} from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Visualization } from '../Visualization';

// ---------------------------------------------------------------------------
// Test data: one spec per dispatch branch
// ---------------------------------------------------------------------------

const chartSpec: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10 },
    { date: '2021-01-01', value: 40 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'GDP Growth',
  },
};

const updatedChartSpec: ChartSpec = {
  ...chartSpec,
  chrome: {
    title: 'Updated Title',
  },
};

const tableSpec: TableSpec = {
  type: 'table',
  data: [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
  ],
  chrome: { title: 'People Table' },
};

const graphSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' },
  ],
  edges: [{ source: 'a', target: 'b' }],
};

const sankeySpec: SankeySpec = {
  type: 'sankey',
  data: [
    { from: 'A', to: 'B', amount: 10 },
    { from: 'B', to: 'C', amount: 10 },
  ],
  encoding: {
    source: { field: 'from', type: 'nominal' },
    target: { field: 'to', type: 'nominal' },
    value: { field: 'amount', type: 'quantitative' },
  },
};

const tileMapSpec: TileMapSpec = {
  type: 'tilemap',
  data: { CA: 5.4, TX: 4.1, NY: 4.5 },
};

const barListSpec: BarListSpec = {
  type: 'barlist',
  data: [
    { name: 'Alpha', value: 30 },
    { name: 'Beta', value: 20 },
  ],
  encoding: {
    label: { field: 'name', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
};

// ---------------------------------------------------------------------------
// Helper: mount Visualization and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountViz(props: {
  spec: VizSpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(Visualization, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Visualization', () => {
  it('renders Chart DOM for a ChartSpec', async () => {
    const wrapper = await mountViz({ spec: chartSpec });

    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('class')).toBe('oc-chart');
    expect(wrapper.find('.oc-title').text()).toBe('GDP Growth');
    wrapper.unmount();
  });

  it('renders table DOM for a TableSpec', async () => {
    const wrapper = await mountViz({ spec: tableSpec });

    const table = wrapper.find('table');
    expect(table.exists()).toBe(true);

    const headers = wrapper.findAll('thead th');
    expect(headers.length).toBe(2);
    wrapper.unmount();
  });

  it('renders Graph DOM (canvas) for a GraphSpec', async () => {
    const wrapper = await mountViz({ spec: graphSpec });

    const canvas = wrapper.find('canvas');
    expect(canvas.exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders Sankey DOM for a SankeySpec', async () => {
    const wrapper = await mountViz({ spec: sankeySpec });

    const nodes = wrapper.findAll('.oc-sankey-node');
    expect(nodes.length).toBe(3);
    wrapper.unmount();
  });

  it('renders TileMap DOM for a TileMapSpec', async () => {
    const wrapper = await mountViz({ spec: tileMapSpec });

    const tiles = wrapper.findAll('.oc-tilemap-tile');
    expect(tiles.length).toBe(51);
    wrapper.unmount();
  });

  it('renders BarList DOM for a BarListSpec', async () => {
    const wrapper = await mountViz({ spec: barListSpec });

    const rows = wrapper.findAll('.oc-barlist-row');
    expect(rows.length).toBe(2);
    wrapper.unmount();
  });

  it('switches renderer when spec kind changes', async () => {
    const wrapper = await mountViz({ spec: chartSpec });

    // Note: charts also render a visually-hidden accessibility <table>, so
    // the root class is the reliable branch discriminator here.
    expect(wrapper.classes()).toContain('oc-chart-root');
    expect(wrapper.find('svg.oc-chart').exists()).toBe(true);

    await wrapper.setProps({ spec: tableSpec });
    await flushPromises();

    expect(wrapper.classes()).toContain('oc-table-root');
    expect(wrapper.find('table').exists()).toBe(true);
    expect(wrapper.find('svg.oc-chart').exists()).toBe(false);
    wrapper.unmount();
  });

  it('spec changes within the same kind trigger re-render', async () => {
    const wrapper = await mountViz({ spec: chartSpec });

    expect(wrapper.find('.oc-title').text()).toBe('GDP Growth');

    await wrapper.setProps({ spec: updatedChartSpec });
    await flushPromises();

    expect(wrapper.find('.oc-title').text()).toBe('Updated Title');
    wrapper.unmount();
  });

  it('unmounting cleans up the underlying instance', async () => {
    const wrapper = await mountViz({ spec: chartSpec });

    expect(wrapper.find('svg').exists()).toBe(true);

    wrapper.unmount();

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('class prop forwards to the dispatched component', async () => {
    const wrapper = await mountViz({ spec: chartSpec, class: 'my-viz' });

    expect(wrapper.classes()).toContain('my-viz');
    wrapper.unmount();
  });

  it('style prop forwards to the dispatched component', async () => {
    const wrapper = await mountViz({
      spec: chartSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountViz({ spec: chartSpec, darkMode: 'force' });

    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
