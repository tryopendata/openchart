import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { GeoMap } from '../GeoMap';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Minimal valid TopoJSON with 3 US states (delta-encoded arcs).
const MINI_TOPO = {
  type: 'Topology',
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
        { type: 'Polygon', id: '36', properties: { name: 'New York' }, arcs: [[2]] },
      ],
    },
  },
  arcs: [
    [
      [-122, 37],
      [4, -3],
      [-3, 2],
      [-1, 1],
    ],
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
    [
      [-74, 41],
      [1, -1],
      [-3, 2],
      [2, -1],
    ],
  ],
};

const mapSpec: GeoMapSpec = {
  type: 'map',
  geo: { features: MINI_TOPO, projection: 'mercator' },
  data: [
    { fips: '06', value: 10 },
    { fips: '48', value: 20 },
  ],
  encoding: {
    key: { field: 'fips', type: 'nominal' },
    color: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'State Values',
    subtitle: 'A tiny choropleth',
    source: 'Test Fixture',
  },
};

const updatedSpec: GeoMapSpec = {
  ...mapSpec,
  data: [
    { fips: '06', value: 100 },
    { fips: '48', value: 200 },
    { fips: '36', value: 300 },
  ],
  chrome: {
    title: 'Updated Title',
  },
};

// ---------------------------------------------------------------------------
// Helper: mount GeoMap and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountGeoMap(props: {
  spec: GeoMapSpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(GeoMap, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GeoMap', () => {
  it('renders an SVG element with map features', async () => {
    const wrapper = await mountGeoMap({ spec: mapSpec });
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    expect(svg.classes()).toContain('oc-map');

    const features = wrapper.findAll('.oc-map-feature');
    expect(features.length).toBe(3);
    wrapper.unmount();
  });

  it('renders chrome text elements', async () => {
    const wrapper = await mountGeoMap({ spec: mapSpec });

    const title = wrapper.find('.oc-title');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('State Values');

    const subtitle = wrapper.find('.oc-subtitle');
    expect(subtitle.text()).toBe('A tiny choropleth');

    const source = wrapper.find('.oc-source');
    expect(source.text()).toContain('Test Fixture');
    wrapper.unmount();
  });

  it('spec changes trigger update on the underlying instance', async () => {
    const wrapper = await mountGeoMap({ spec: mapSpec });

    const titleBefore = wrapper.find('.oc-title');
    expect(titleBefore.text()).toBe('State Values');

    await wrapper.setProps({ spec: updatedSpec });
    await flushPromises();

    const titleAfter = wrapper.find('.oc-title');
    expect(titleAfter.text()).toBe('Updated Title');

    const features = wrapper.findAll('.oc-map-feature');
    expect(features.length).toBe(3);
    wrapper.unmount();
  });

  it('unmounting cleans up map instance', async () => {
    const wrapper = await mountGeoMap({ spec: mapSpec });

    const svgBefore = wrapper.find('svg');
    expect(svgBefore.exists()).toBe(true);

    wrapper.unmount();

    // After unmounting, the wrapper element should be empty
    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('class prop passes through to wrapper div', async () => {
    const wrapper = await mountGeoMap({ spec: mapSpec, class: 'my-map' });

    expect(wrapper.classes()).toContain('oc-map-root');
    expect(wrapper.classes()).toContain('my-map');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountGeoMap({ spec: mapSpec, darkMode: 'force' });

    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    wrapper.unmount();
  });

  it('style prop passes through to wrapper div', async () => {
    const wrapper = await mountGeoMap({
      spec: mapSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
  });
});
it('forwards the inventory host and replaces it without remounting or losing the camera', async () => {
  const spec: GeoMapSpec = {
    ...mapSpec,
    animation: false,
    callouts: [
      {
        id: 'custom',
        anchor: { kind: 'coordinate', space: 'geographic', x: -100, y: 35 },
        text: 'Exact coordinate note',
        minZoom: 2,
      },
    ],
  };
  const first = document.createElement('aside'),
    second = document.createElement('aside');
  const wrapper = mount(GeoMap, { props: { spec, labelInventory: { container: first } } });
  await flushPromises();
  expect(first.querySelector('details')).not.toBeNull();
  const instance = (
    wrapper.vm as unknown as { instance: import('@opendata-ai/openchart-vanilla').GeoMapInstance }
  ).instance;
  const svg = wrapper.element.querySelector('svg');
  instance.setCamera({ ...instance.getCamera(), k: 2 });
  await wrapper.setProps({ labelInventory: { container: second } });
  expect(first.querySelector('details')).toBeNull();
  expect(second.querySelector('details')).not.toBeNull();
  expect(wrapper.element.querySelector('svg')).toBe(svg);
  expect(instance.getCamera().k).toBe(2);
  wrapper.unmount();
  expect(second.querySelector('details')).toBeNull();
});
it('keeps map reader pins while moving the readout and applying controlled state without echo', async () => {
  const first = document.createElement('aside'),
    second = document.createElement('aside');
  const wrapper = mount(GeoMap, {
    props: { spec: { ...mapSpec, animation: false }, reader: { panel: { container: first } } },
  });
  await flushPromises();
  wrapper.element
    .querySelector('.oc-map-inspect-places')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  wrapper.element
    .querySelector('.oc-map-inspect-places')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const state = wrapper
    .emitted('reader-change')!
    .at(-1)![0] as import('@opendata-ai/openchart-core').GeoReaderSelection;
  expect(state.pinned).toHaveLength(1);
  const svg = wrapper.element.querySelector('svg'),
    count = wrapper.emitted('reader-change')!.length;
  await wrapper.setProps({ reader: { panel: { container: second } }, readerSelection: state });
  expect(wrapper.element.querySelector('svg')).toBe(svg);
  expect(wrapper.emitted('reader-change')).toHaveLength(count);
  expect(first.querySelector('.oc-reader-panel')).toBeNull();
  expect(second.textContent).toContain('A:');
  wrapper.unmount();
  expect(second.querySelector('.oc-reader-panel')).toBeNull();
});

it('emits scoped camera metadata from its exposed instance', async () => {
  const spec: GeoMapSpec = {
    ...mapSpec,
    chrome: undefined,
    animation: false,
    geo: {
      ...mapSpec.geo,
      insets: [
        {
          id: 'texas',
          label: 'Texas',
          featureIds: ['48'],
          placement: 'bottom-left',
          width: 80,
          removeFromMain: false,
        },
      ],
    },
  };
  const wrapper = mount(GeoMap, { props: { spec } });
  await flushPromises();
  const instance = (
    wrapper.vm as unknown as { instance: import('@opendata-ai/openchart-vanilla').GeoMapInstance }
  ).instance;
  const camera = { ...instance.getCamera('texas'), k: 2 };
  instance.setCamera(camera, { viewId: 'texas' });
  expect(wrapper.emitted('camera-change')?.at(-1)).toEqual([camera, { viewId: 'texas' }]);
  wrapper.unmount();
});
