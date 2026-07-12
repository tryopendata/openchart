import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChartStory, type ChartStoryHandle } from '../ChartStory';

const baseSpec: ChartSpec = {
  mark: 'line',
  data: [
    { year: '2008', value: 10, country: 'US' },
    { year: '2012', value: 40, country: 'US' },
    { year: '2016', value: 25, country: 'US' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'Base' },
};

const steps = [
  {},
  { spec: { chrome: { title: 'One' } } },
  { spec: { chrome: { subtitle: 'Two' } } },
];
const narrative = [<p key="a">Intro</p>, <p key="b">Middle</p>, <p key="c">End</p>];

describe('ChartStory', () => {
  afterEach(cleanup);

  it('renders the sticky chart panel and one block per step', async () => {
    const { container } = render(
      <ChartStory spec={baseSpec} steps={steps} narrative={narrative} />,
    );

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    // The chart mounts and a title renders (self-driving scroll may advance
    // the step in a headless layout; the block count is the stable assertion).
    expect(container.querySelector('.oc-title')).not.toBeNull();
    // One narrative block per step.
    expect(container.querySelectorAll('[data-oc-story-step]')).toHaveLength(3);
  });

  it('drives the story from the controlled step prop', async () => {
    const { container, rerender } = render(
      <ChartStory spec={baseSpec} steps={steps} narrative={narrative} step={0} />,
    );

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    rerender(<ChartStory spec={baseSpec} steps={steps} narrative={narrative} step={2} />);

    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('One');
      expect(container.querySelector('.oc-subtitle')?.textContent).toBe('Two');
    });
  });

  it('exposes goTo and the underlying instance through the ref', async () => {
    const ref = createRef<ChartStoryHandle>();
    const { container } = render(
      <ChartStory ref={ref} spec={baseSpec} steps={steps} narrative={narrative} />,
    );

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    expect(ref.current?.instance).not.toBeNull();
    ref.current?.goTo(1);
    expect(container.querySelector('.oc-title')?.textContent).toBe('One');
  });

  it('tears down the story instance on unmount', async () => {
    const ref = createRef<ChartStoryHandle>();
    const { container, unmount } = render(
      <ChartStory ref={ref} spec={baseSpec} steps={steps} narrative={narrative} />,
    );

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    unmount();
    expect(container.querySelector('svg')).toBeNull();
  });
});
