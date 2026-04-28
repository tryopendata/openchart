import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createTileMap } from '../tilemap-mount';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const basicTileMapSpec = {
  type: 'tilemap' as const,
  data: { CA: 5.4, TX: 4.1, NY: 4.5, FL: 3.3, IL: 4.6 } as Record<string, number>,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createTileMap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts an SVG element into the container', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('oc-tilemap')).toBe(true);

    instance.destroy();
  });

  it('renders correct number of tile elements', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const tiles = container.querySelectorAll('.oc-tilemap-tile');
    // CA, TX, NY, FL, IL = 5 tiles
    expect(tiles).toHaveLength(5);

    instance.destroy();
  });

  it('update() re-renders with new data', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const tilesBefore = container.querySelectorAll('.oc-tilemap-tile');
    expect(tilesBefore).toHaveLength(5);

    // Update with fewer states
    const updatedSpec = {
      ...basicTileMapSpec,
      data: { CA: 5.4, TX: 4.1 } as Record<string, number>,
    };
    instance.update(updatedSpec);

    const tilesAfter = container.querySelectorAll('.oc-tilemap-tile');
    expect(tilesAfter).toHaveLength(2);

    instance.destroy();
  });

  it('destroy() removes the SVG from the container', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    instance.destroy();

    const svgAfter = container.querySelector('svg');
    expect(svgAfter).toBeNull();
  });

  it('gradient legend renders', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const legend = container.querySelector('.oc-tilemap-legend');
    expect(legend).not.toBeNull();

    instance.destroy();
  });

  it('layout property returns the compiled layout', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    expect(instance.layout).toBeDefined();
    expect(instance.layout.tiles).toHaveLength(5);
    expect(instance.layout.gradientLegend).toBeDefined();

    instance.destroy();
  });

  it('export("svg") returns a string containing SVG content', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const svgString = instance.export('svg');
    expect(typeof svgString).toBe('string');
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('oc-tilemap');

    instance.destroy();
  });
});
