import type { BarListSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BarList } from '../BarList';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const barListSpec: BarListSpec = {
  type: 'barlist',
  data: [
    { name: 'Alpha', count: 40 },
    { name: 'Beta', count: 25 },
    { name: 'Gamma', count: 10 },
  ],
  encoding: {
    label: { field: 'name', type: 'nominal' },
    value: { field: 'count', type: 'quantitative' },
  },
  chrome: { title: 'Top Items' },
};

const updatedSpec: BarListSpec = {
  type: 'barlist',
  data: [
    { name: 'One', count: 5 },
    { name: 'Two', count: 3 },
  ],
  encoding: {
    label: { field: 'name', type: 'nominal' },
    value: { field: 'count', type: 'quantitative' },
  },
  chrome: { title: 'Updated Items' },
};

// ---------------------------------------------------------------------------
// Helper: render BarList and wait for SVG to appear (useEffect is deferred)
// ---------------------------------------------------------------------------

async function renderBarList(props: React.ComponentProps<typeof BarList>) {
  const result = render(<BarList {...props} />);
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

describe('<BarList />', () => {
  it('renders an SVG element', async () => {
    const { container } = await renderBarList({ spec: barListSpec });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('oc-barlist');
  });

  it('renders one row per data item', async () => {
    const { container } = await renderBarList({ spec: barListSpec });
    const rows = container.querySelectorAll('.oc-barlist-row');
    expect(rows.length).toBe(3);
  });

  it('renders chrome title', async () => {
    const { container } = await renderBarList({ spec: barListSpec });

    const title = container.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Top Items');
  });

  it('spec changes trigger re-render', async () => {
    const { container, rerender } = await renderBarList({ spec: barListSpec });

    const titleBefore = container.querySelector('.oc-title');
    expect(titleBefore?.textContent).toBe('Top Items');

    rerender(<BarList spec={updatedSpec} />);
    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('Updated Items');
    });

    const rowsAfter = container.querySelectorAll('.oc-barlist-row');
    expect(rowsAfter.length).toBe(2);
  });

  it('unmounting cleans up barlist instance', async () => {
    const { container, unmount } = await renderBarList({ spec: barListSpec });

    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    unmount();

    expect(container.querySelector('svg')).toBeNull();
  });

  it('className prop passes through to wrapper div', async () => {
    const { container } = await renderBarList({ spec: barListSpec, className: 'my-barlist' });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.className).toContain('oc-barlist-root');
    expect(wrapper?.className).toContain('my-barlist');
  });

  it('style prop passes through to wrapper div', async () => {
    const { container } = await renderBarList({
      spec: barListSpec,
      style: { border: '1px solid red' },
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper?.style.border).toBe('1px solid red');
  });

  it('renders with dark mode option', async () => {
    const { container } = await renderBarList({ spec: barListSpec, darkMode: 'force' });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
