import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
// Helper: render GeoMap and wait for SVG to appear (useEffect is deferred)
// ---------------------------------------------------------------------------

async function renderGeoMap(props: React.ComponentProps<typeof GeoMap>) {
  const result = render(<GeoMap {...props} />);
  await waitFor(() => {
    expect(result.container.querySelector('svg')).not.toBeNull();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

describe('<GeoMap />', () => {
  it('renders an SVG element with map features', async () => {
    const { container } = await renderGeoMap({ spec: mapSpec });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('oc-map')).toBe(true);

    const features = container.querySelectorAll('.oc-map-feature');
    expect(features.length).toBe(3);
  });

  it('renders chrome text elements', async () => {
    const { container } = await renderGeoMap({ spec: mapSpec });

    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('State Values');

    const subtitle = container.querySelector('.oc-subtitle');
    expect(subtitle?.textContent).toBe('A tiny choropleth');

    const source = container.querySelector('.oc-source');
    expect(source?.textContent).toContain('Test Fixture');
  });

  it('spec changes trigger update on the underlying instance', async () => {
    const { container, rerender } = await renderGeoMap({ spec: mapSpec });

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('State Values');

    rerender(<GeoMap spec={updatedSpec} />);
    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('Updated Title');
    });

    const features = container.querySelectorAll('.oc-map-feature');
    expect(features.length).toBe(3);
  });

  it('unmounting cleans up map instance', async () => {
    const { container, unmount } = await renderGeoMap({ spec: mapSpec });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('svg')).toBeNull();
  });

  it('className prop passes through to wrapper div', async () => {
    const { container } = await renderGeoMap({ spec: mapSpec, className: 'my-map' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('oc-map-root');
    expect(wrapper?.className).toContain('my-map');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderGeoMap({ spec: mapSpec, darkMode: 'force' });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderGeoMap({
      spec: mapSpec,
      style: { border: '1px solid red' },
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });
});
