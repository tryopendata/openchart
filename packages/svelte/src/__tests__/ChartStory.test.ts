import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Harness from './ChartStoryHarness.svelte';

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

describe('ChartStory (Svelte)', () => {
  afterEach(cleanup);

  it('renders the chart panel and one block per step', async () => {
    const { container } = render(Harness, { props: { spec: baseSpec, steps } });

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    expect(container.querySelectorAll('[data-oc-story-step]')).toHaveLength(3);
  });

  it('drives the story from the controlled step prop', async () => {
    const { container, rerender } = render(Harness, { props: { spec: baseSpec, steps, step: 0 } });

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    await rerender({ spec: baseSpec, steps, step: 2 });

    await waitFor(() => {
      expect(container.querySelector('.oc-title')?.textContent).toBe('One');
      expect(container.querySelector('.oc-subtitle')?.textContent).toBe('Two');
    });
  });

  it('tears down the chart on unmount', async () => {
    const { container, unmount } = render(Harness, { props: { spec: baseSpec, steps } });

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    unmount();
    expect(container.querySelector('svg')).toBeNull();
  });
});
