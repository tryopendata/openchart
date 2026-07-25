import type { TileMapSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TileMap } from '../TileMap';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const tileMapSpec: TileMapSpec = {
  type: 'tilemap',
  data: [
    { state: 'CA', value: 10 },
    { state: 'TX', value: 20 },
    { state: 'NY', value: 30 },
  ],
  encoding: {
    state: { field: 'state', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'State Values' },
};

const updatedSpec: TileMapSpec = {
  type: 'tilemap',
  data: [
    { state: 'WA', value: 5 },
    { state: 'OR', value: 15 },
  ],
  encoding: {
    state: { field: 'state', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'Updated Values' },
};

// ---------------------------------------------------------------------------
// Helper: render TileMap and wait for SVG to appear (useEffect is deferred)
// ---------------------------------------------------------------------------

async function renderTileMap(props: React.ComponentProps<typeof TileMap>) {
  const result = render(<TileMap {...props} />);
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

describe('<TileMap />', () => {
  it('renders an SVG element', async () => {
    const { container } = await renderTileMap({ spec: tileMapSpec });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('oc-tilemap');
  });

  it('renders tile groups', async () => {
    const { container } = await renderTileMap({ spec: tileMapSpec });
    const tiles = container.querySelectorAll('.oc-tilemap-tile');
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('renders chrome title', async () => {
    const { container } = await renderTileMap({ spec: tileMapSpec });

    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('State Values');
  });

  it('spec changes trigger re-render', async () => {
    const { container, rerender } = await renderTileMap({ spec: tileMapSpec });

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('State Values');

    rerender(<TileMap spec={updatedSpec} />);
    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('Updated Values');
    });
  });

  it('unmounting cleans up tilemap instance', async () => {
    const { container, unmount } = await renderTileMap({ spec: tileMapSpec });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('svg')).toBeNull();
  });

  it('className prop passes through to wrapper div', async () => {
    const { container } = await renderTileMap({ spec: tileMapSpec, className: 'my-tilemap' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('oc-tilemap-root');
    expect(wrapper?.className).toContain('my-tilemap');
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderTileMap({
      spec: tileMapSpec,
      style: { border: '1px solid red' },
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderTileMap({ spec: tileMapSpec, darkMode: 'force' });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
