import type { TileMapSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { TileMap } from '../TileMap';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const basicSpec: TileMapSpec = {
  type: 'tilemap',
  data: { CA: 5.4, TX: 4.1, NY: 4.5, FL: 3.3, IL: 4.6 },
  chrome: {
    title: 'Unemployment Rate',
  },
};

const updatedSpec: TileMapSpec = {
  type: 'tilemap',
  data: { CA: 1.1, TX: 2.2, NY: 3.3 },
  chrome: {
    title: 'Updated Rate',
  },
};

// ---------------------------------------------------------------------------
// Helper: mount TileMap and wait for the vanilla adapter to render
// ---------------------------------------------------------------------------

async function mountTileMap(props: {
  spec: TileMapSpec;
  class?: string;
  darkMode?: string;
  style?: string | Record<string, string>;
}) {
  const wrapper = mount(TileMap, { props: props as Record<string, unknown> });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TileMap', () => {
  it('renders an SVG element with all 51 state tiles', async () => {
    const wrapper = await mountTileMap({ spec: basicSpec });
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);

    const tiles = wrapper.findAll('.oc-tilemap-tile');
    expect(tiles.length).toBe(51);
    wrapper.unmount();
  });

  it('renders chrome text elements', async () => {
    const wrapper = await mountTileMap({ spec: basicSpec });

    const title = wrapper.find('.oc-title');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('Unemployment Rate');
    wrapper.unmount();
  });

  it('spec changes trigger update on the underlying instance', async () => {
    const wrapper = await mountTileMap({ spec: basicSpec });

    const titleBefore = wrapper.find('.oc-title');
    expect(titleBefore.text()).toBe('Unemployment Rate');

    await wrapper.setProps({ spec: updatedSpec });
    await flushPromises();

    const titleAfter = wrapper.find('.oc-title');
    expect(titleAfter.text()).toBe('Updated Rate');

    // The full tile grid is always rendered regardless of data coverage
    const tiles = wrapper.findAll('.oc-tilemap-tile');
    expect(tiles.length).toBe(51);
    wrapper.unmount();
  });

  it('unmounting cleans up the tilemap instance', async () => {
    const wrapper = await mountTileMap({ spec: basicSpec });

    const svgBefore = wrapper.find('svg');
    expect(svgBefore.exists()).toBe(true);

    wrapper.unmount();

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('class prop passes through to wrapper div', async () => {
    const wrapper = await mountTileMap({ spec: basicSpec, class: 'my-tilemap' });

    expect(wrapper.classes()).toContain('oc-tilemap-root');
    expect(wrapper.classes()).toContain('my-tilemap');
    wrapper.unmount();
  });

  it('style prop passes through to wrapper div', async () => {
    const wrapper = await mountTileMap({
      spec: basicSpec,
      style: { border: '1px solid red' },
    });

    expect(wrapper.attributes('style')).toContain('border');
    wrapper.unmount();
  });

  it('renders with dark mode option', async () => {
    const wrapper = await mountTileMap({ spec: basicSpec, darkMode: 'force' });

    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    wrapper.unmount();
  });
});
