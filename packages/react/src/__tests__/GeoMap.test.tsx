import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('geo.zoom in the spec alone enables reader zoom; onCameraChange reports moves', async () => {
    const onCameraChange = vi.fn();
    const zoomSpec: GeoMapSpec = { ...mapSpec, geo: { ...mapSpec.geo, zoom: true } };
    const { container } = await renderGeoMap({ spec: zoomSpec, onCameraChange });

    const zoomIn = container.querySelector(
      '.oc-map-zoom-btn[data-zoom="in"]',
    ) as HTMLButtonElement | null;
    expect(zoomIn).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('tabindex')).toBe('0');

    zoomIn!.click();
    await waitFor(() => {
      expect(onCameraChange).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onCameraChange.mock.lastCall?.[0].k).toBeCloseTo(2);
    });
  });

  it('maps without geo.zoom render no zoom controls', async () => {
    const { container } = await renderGeoMap({ spec: mapSpec });
    expect(container.querySelector('.oc-map-zoom')).toBeNull();
  });
});
it('keeps one inventory in StrictMode and replaces its host and callbacks without recreating the map', async () => {
  const { createRef, StrictMode } = await import('react');
  const ref = createRef<import('../GeoMap').GeoMapHandle>();
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
  const before = vi.fn(),
    after = vi.fn();
  const result = render(
    <StrictMode>
      <GeoMap ref={ref} spec={spec} labelInventory={{ container: first }} onCameraChange={before} />
    </StrictMode>,
  );
  await waitFor(() => expect(first.querySelectorAll('details')).toHaveLength(1));
  const instance = ref.current!.instance!;
  const svg = result.container.querySelector('svg');
  instance.setCamera({ ...instance.getCamera(), k: 2 });
  result.rerender(
    <StrictMode>
      <GeoMap ref={ref} spec={spec} labelInventory={{ container: second }} onCameraChange={after} />
    </StrictMode>,
  );
  await waitFor(() => expect(second.querySelectorAll('details')).toHaveLength(1));
  expect(first.querySelector('details')).toBeNull();
  expect(ref.current?.instance).toBe(instance);
  expect(result.container.querySelector('svg')).toBe(svg);
  expect(instance.getCamera().k).toBe(2);
  const count = before.mock.calls.length;
  instance.setCamera({ ...instance.getCamera(), k: 3 });
  expect(before).toHaveBeenCalledTimes(count);
  expect(after).toHaveBeenCalledTimes(1);
  expect(result.container.querySelectorAll('.oc-map-label-inventory')).toHaveLength(1);
  result.unmount();
  expect(second.querySelector('details')).toBeNull();
});
it('keeps reader pins and silently applies controlled state while panel hosts and callbacks change', async () => {
  const first = document.createElement('aside'),
    second = document.createElement('aside');
  const before = vi.fn(),
    after = vi.fn();
  const result = await renderGeoMap({
    spec: { ...mapSpec, animation: false },
    reader: { panel: { container: first } },
    onReaderChange: before,
  });
  const root = result.container.querySelector('.oc-map-inspect-places')!;
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const state = before.mock.calls.at(
    -1,
  )![0] as import('@opendata-ai/openchart-core').GeoReaderSelection;
  expect(state.pinned).toHaveLength(1);
  const svg = result.container.querySelector('svg');
  result.rerender(
    <GeoMap
      spec={{ ...mapSpec, animation: false }}
      reader={{ panel: { container: second } }}
      readerSelection={state}
      onReaderChange={after}
    />,
  );
  await waitFor(() => expect(second.querySelector('.oc-reader-panel')).not.toBeNull());
  expect(first.querySelector('.oc-reader-panel')).toBeNull();
  expect(result.container.querySelector('svg')).toBe(svg);
  expect(after).not.toHaveBeenCalled();
  expect(second.textContent).toContain('A:');
  result.unmount();
  expect(second.querySelector('.oc-reader-panel')).toBeNull();
});

it('forwards scoped camera metadata through the stable imperative instance', async () => {
  const { createRef } = await import('react');
  const ref = createRef<import('../GeoMap').GeoMapHandle>();
  const changed = vi.fn();
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
  const result = render(<GeoMap ref={ref} spec={spec} onCameraChange={changed} />);
  await waitFor(() => expect(ref.current?.instance?.getCameras().texas).toBeDefined());
  const instance = ref.current!.instance!;
  const camera = { ...instance.getCamera('texas'), k: 2 };
  instance.setCamera(camera, { viewId: 'texas' });
  expect(changed).toHaveBeenLastCalledWith(camera, { viewId: 'texas' });
  result.unmount();
});
