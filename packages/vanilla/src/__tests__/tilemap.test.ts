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

  it('hovering a tile arms the group dim and outlines that tile', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const group = container.querySelector('.oc-tilemap-tiles')!;
    const tile = container.querySelector('.oc-tilemap-tile')!;

    tile.dispatchEvent(new MouseEvent('mouseenter'));
    expect(group.classList.contains('oc-hover-active')).toBe(true);
    expect(tile.classList.contains('oc-tilemap-tile--hover')).toBe(true);

    tile.dispatchEvent(new MouseEvent('mouseleave'));
    expect(group.classList.contains('oc-hover-active')).toBe(false);
    expect(tile.classList.contains('oc-tilemap-tile--hover')).toBe(false);

    instance.destroy();
  });

  it('renders all 51 state tiles', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    const tiles = container.querySelectorAll('.oc-tilemap-tile');
    expect(tiles).toHaveLength(51);

    instance.destroy();
  });

  it('update() re-renders with new data', () => {
    const instance = createTileMap(container, basicTileMapSpec, { responsive: false });

    // Update with full data
    const updatedSpec = {
      ...basicTileMapSpec,
      data: {
        AL: 2.7,
        AK: 6.4,
        AZ: 3.5,
        AR: 3.4,
        CA: 5.4,
        CO: 3.4,
        CT: 4.1,
        DE: 4.4,
        FL: 3.3,
        GA: 3.4,
        HI: 3.2,
        ID: 3.0,
        IL: 4.6,
        IN: 3.3,
        IA: 2.7,
        KS: 3.2,
        KY: 4.4,
        LA: 3.6,
        ME: 3.6,
        MD: 1.8,
        MA: 3.3,
        MI: 4.2,
        MN: 2.8,
        MS: 3.7,
        MO: 3.5,
        MT: 2.9,
        NE: 2.2,
        NV: 5.4,
        NH: 2.4,
        NJ: 4.8,
        NM: 4.1,
        NY: 4.5,
        NC: 3.5,
        ND: 1.9,
        OH: 4.0,
        OK: 3.9,
        OR: 4.2,
        PA: 3.4,
        RI: 3.8,
        SC: 3.3,
        SD: 2.0,
        TN: 3.5,
        TX: 4.1,
        UT: 2.9,
        VT: 2.3,
        VA: 2.9,
        WA: 4.6,
        WV: 4.0,
        WI: 2.9,
        WY: 3.2,
        DC: 5.2,
      } as Record<string, number>,
    };
    instance.update(updatedSpec);

    // All tiles should have data now
    const dataTiles = instance.layout.tiles.filter((t) => t.hasData);
    expect(dataTiles).toHaveLength(51);

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
    expect(instance.layout.tiles).toHaveLength(51);
    expect(instance.layout.gradientLegend).not.toBeNull();

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
