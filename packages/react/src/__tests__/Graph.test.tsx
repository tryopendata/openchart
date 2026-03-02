import type { GraphSpec } from '@opendata-ai/core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Graph } from '../Graph';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const basicSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' },
    { id: 'c', label: 'Node C' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
  chrome: {
    title: 'Test Graph',
    subtitle: 'A simple test graph',
  },
};

const updatedSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'x', label: 'Node X' },
    { id: 'y', label: 'Node Y' },
  ],
  edges: [{ source: 'x', target: 'y' }],
  chrome: {
    title: 'Updated Graph',
  },
};

// ---------------------------------------------------------------------------
// Helper: render Graph and wait for canvas to mount (useEffect is deferred)
// ---------------------------------------------------------------------------

async function renderGraph(props: React.ComponentProps<typeof Graph>) {
  const result = render(<Graph {...props} />);
  await waitFor(() => {
    expect(result.container.querySelector('canvas')).not.toBeNull();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

describe('<Graph />', () => {
  it('renders a container div', async () => {
    const { container } = await renderGraph({ spec: basicSpec });
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.tagName.toLowerCase()).toBe('div');
  });

  it('mounts graph instance with canvas element', async () => {
    const { container } = await renderGraph({ spec: basicSpec });
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('renders chrome text elements', async () => {
    const { container } = await renderGraph({ spec: basicSpec });

    const title = container.querySelector('.viz-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Test Graph');

    const subtitle = container.querySelector('.viz-subtitle');
    expect(subtitle?.textContent).toBe('A simple test graph');
  });

  it('spec changes trigger re-render', async () => {
    const { container, rerender } = await renderGraph({ spec: basicSpec });

    const titleBefore = container.querySelector('.viz-title');
    expect(titleBefore?.textContent).toBe('Test Graph');

    rerender(<Graph spec={updatedSpec} />);
    await waitFor(() => {
      expect(container.querySelector('.viz-title')?.textContent).toBe('Updated Graph');
    });
  });

  it('unmounting cleans up graph instance', async () => {
    const { container, unmount } = await renderGraph({ spec: basicSpec });

    const canvasBefore = container.querySelector('canvas');
    expect(canvasBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('canvas')).toBeNull();
  });

  it('className prop passes through to wrapper div', async () => {
    const { container } = await renderGraph({ spec: basicSpec, className: 'my-graph' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('my-graph');
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderGraph({
      spec: basicSpec,
      style: { border: '1px solid red' },
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderGraph({ spec: basicSpec, darkMode: 'force' });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });
});
