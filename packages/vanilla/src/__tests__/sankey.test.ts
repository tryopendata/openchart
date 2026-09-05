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

// ---------------------------------------------------------------------------
// Path highlighting (Phase 6)
// ---------------------------------------------------------------------------

describe('sankey path highlighting', () => {
  let container: HTMLDivElement;

  // A -> B -> C, plus A -> D. Hovering B must light the whole A->B->C path and
  // leave the A->D branch off-path.
  const branching = {
    type: 'sankey' as const,
    data: [
      { from: 'A', to: 'B', amount: 10 },
      { from: 'B', to: 'C', amount: 10 },
      { from: 'A', to: 'D', amount: 5 },
    ],
    encoding: {
      source: { field: 'from', type: 'nominal' as const },
      target: { field: 'to', type: 'nominal' as const },
      value: { field: 'amount', type: 'quantitative' as const },
    },
  };

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function linkOpacity(source: string, target: string): number {
    const el = container.querySelector(
      `.oc-sankey-link[data-source="${source}"][data-target="${target}"] path`,
    );
    return Number(el?.getAttribute('fill-opacity'));
  }

  function nodeOpacity(selector: string, id: string): string {
    const el = container.querySelector(`${selector}[data-node-id="${id}"]`) as SVGElement | null;
    return el?.style.opacity ?? '';
  }

  function hover(nodeId: string): void {
    const el = container.querySelector(`.oc-sankey-node[data-node-id="${nodeId}"]`);
    el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  }

  it('traces upstream and downstream from the hovered node', () => {
    const instance = createSankey(container, branching, { responsive: false });

    hover('B');
    expect(linkOpacity('A', 'B')).toBe(0.7);
    expect(linkOpacity('B', 'C')).toBe(0.7);
    expect(linkOpacity('A', 'D')).toBe(0.12);

    // On-path nodes and labels keep full ink; off-path drop to the hover dim.
    for (const id of ['A', 'B', 'C']) {
      expect(nodeOpacity('.oc-sankey-node', id)).toBe('1');
      expect(nodeOpacity('.oc-sankey-label', id)).toBe('1');
    }
    expect(nodeOpacity('.oc-sankey-node', 'D')).toBe('0.3');
    expect(nodeOpacity('.oc-sankey-label', 'D')).toBe('0.3');

    instance.destroy();
  });

  it('restores the compiled opacities on mouseleave', () => {
    const instance = createSankey(container, branching, { responsive: false });

    hover('B');
    const el = container.querySelector('.oc-sankey-node[data-node-id="B"]');
    el?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));

    expect(linkOpacity('A', 'D')).toBe(0.5);
    expect(nodeOpacity('.oc-sankey-node', 'D')).toBe('1');

    instance.destroy();
  });

  it('a link hover lights only the path running through that link', () => {
    const instance = createSankey(container, branching, { responsive: false });

    const link = container.querySelector('.oc-sankey-link[data-source="A"][data-target="D"]');
    link?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));

    expect(linkOpacity('A', 'D')).toBe(0.7);
    // A's other branch is a sibling of the hovered link, not on its path.
    expect(linkOpacity('A', 'B')).toBe(0.12);
    expect(nodeOpacity('.oc-sankey-node', 'D')).toBe('1');
    expect(nodeOpacity('.oc-sankey-node', 'A')).toBe('1');

    instance.destroy();
  });

  it('labels carry their node id and the value tspan', () => {
    const instance = createSankey(container, branching, { responsive: false });

    const label = container.querySelector('.oc-sankey-label[data-node-id="B"]');
    expect(label).not.toBeNull();
    const value = label?.querySelector('.oc-sankey-label-value');
    expect(value?.textContent).toBe('10');

    instance.destroy();
  });
});
