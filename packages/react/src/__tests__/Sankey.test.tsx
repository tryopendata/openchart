import type { SankeySpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sankey } from '../Sankey';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sankeySpec: SankeySpec = {
  type: 'sankey',
  data: [
    { source: 'Coal', target: 'Electricity', value: 30 },
    { source: 'Gas', target: 'Electricity', value: 20 },
    { source: 'Electricity', target: 'Homes', value: 50 },
  ],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'Energy Flow' },
};

const updatedSpec: SankeySpec = {
  type: 'sankey',
  data: [
    { source: 'A', target: 'B', value: 10 },
    { source: 'B', target: 'C', value: 10 },
  ],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'Updated Flow' },
};

// ---------------------------------------------------------------------------
// Helper: render Sankey and wait for SVG to appear (useEffect is deferred)
// ---------------------------------------------------------------------------

async function renderSankey(props: React.ComponentProps<typeof Sankey>) {
  const result = render(<Sankey {...props} />);
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

describe('<Sankey />', () => {
  it('renders an SVG element', async () => {
    const { container } = await renderSankey({ spec: sankeySpec });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('oc-sankey');
  });

  it('renders one node group per distinct node', async () => {
    const { container } = await renderSankey({ spec: sankeySpec });
    // Coal, Gas, Electricity, Homes
    const nodes = container.querySelectorAll('.oc-sankey-node');
    expect(nodes.length).toBe(4);
  });

  it('renders one link group per data row', async () => {
    const { container } = await renderSankey({ spec: sankeySpec });
    const links = container.querySelectorAll('.oc-sankey-link');
    expect(links.length).toBe(3);
  });

  it('renders chrome title', async () => {
    const { container } = await renderSankey({ spec: sankeySpec });

    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Energy Flow');
  });

  it('spec changes trigger re-render', async () => {
    const { container, rerender } = await renderSankey({ spec: sankeySpec });

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('Energy Flow');

    rerender(<Sankey spec={updatedSpec} />);
    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('Updated Flow');
    });

    const nodesAfter = container.querySelectorAll('.oc-sankey-node');
    expect(nodesAfter.length).toBe(3);
  });

  it('unmounting cleans up sankey instance', async () => {
    const { container, unmount } = await renderSankey({ spec: sankeySpec });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('svg')).toBeNull();
  });

  it('className prop passes through to wrapper div', async () => {
    const { container } = await renderSankey({ spec: sankeySpec, className: 'my-sankey' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('oc-sankey-root');
    expect(wrapper?.className).toContain('my-sankey');
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderSankey({
      spec: sankeySpec,
      style: { border: '1px solid red' },
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderSankey({ spec: sankeySpec, darkMode: 'force' });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
