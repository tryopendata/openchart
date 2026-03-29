import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createSankey } from '../sankey-mount';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const basicSankeySpec = {
  type: 'sankey' as const,
  data: [
    { from: 'A', to: 'C', amount: 10 },
    { from: 'B', to: 'C', amount: 20 },
    { from: 'C', to: 'D', amount: 15 },
    { from: 'C', to: 'E', amount: 15 },
  ],
  encoding: {
    source: { field: 'from', type: 'nominal' as const },
    target: { field: 'to', type: 'nominal' as const },
    value: { field: 'amount', type: 'quantitative' as const },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSankey', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts an SVG element into the container', () => {
    const instance = createSankey(container, basicSankeySpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('oc-chart');

    instance.destroy();
  });

  it('renders the correct number of sankey node elements', () => {
    const instance = createSankey(container, basicSankeySpec, { responsive: false });

    const nodes = container.querySelectorAll('.oc-sankey-node');
    // A, B, C, D, E = 5 nodes
    expect(nodes).toHaveLength(5);

    instance.destroy();
  });

  it('renders the correct number of sankey link elements', () => {
    const instance = createSankey(container, basicSankeySpec, { responsive: false });

    const links = container.querySelectorAll('.oc-sankey-link');
    // A->C, B->C, C->D, C->E = 4 links
    expect(links).toHaveLength(4);

    instance.destroy();
  });

  it('creates gradient defs when linkStyle is gradient', () => {
    const spec = { ...basicSankeySpec, linkStyle: 'gradient' as const };
    const instance = createSankey(container, spec, { responsive: false });

    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients.length).toBeGreaterThan(0);

    instance.destroy();
  });

  it('update() replaces the SVG with new content', () => {
    const instance = createSankey(container, basicSankeySpec, { responsive: false });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    // Update with different data
    const updatedSpec = {
      ...basicSankeySpec,
      data: [{ from: 'X', to: 'Y', amount: 50 }],
    };
    instance.update(updatedSpec);

    const svgAfter = container.querySelector('svg');
    expect(svgAfter).not.toBeNull();

    // Should now have 2 nodes (X and Y) instead of 5
    const nodes = container.querySelectorAll('.oc-sankey-node');
    expect(nodes).toHaveLength(2);

    instance.destroy();
  });

  it('destroy() removes the SVG from the container', () => {
    const instance = createSankey(container, basicSankeySpec, { responsive: false });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    instance.destroy();

    const svgAfter = container.querySelector('svg');
    expect(svgAfter).toBeNull();
  });

  it('has oc-animate class when animation is enabled', () => {
    const spec = { ...basicSankeySpec, animation: true };
    const instance = createSankey(container, spec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('oc-animate')).toBe(true);

    instance.destroy();
  });

  it('layout property returns the compiled layout', () => {
    const instance = createSankey(container, basicSankeySpec, { responsive: false });

    expect(instance.layout).toBeDefined();
    expect(instance.layout.nodes).toHaveLength(5);
    expect(instance.layout.links).toHaveLength(4);

    instance.destroy();
  });
});
