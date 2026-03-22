/**
 * Tests for useDarkMode composable.
 *
 * Since useDarkMode uses Svelte 5 runes ($state, $effect), it needs to run
 * in a Svelte component context. We test by rendering a Chart component with
 * dark mode options and verifying it renders correctly.
 *
 * Direct unit testing of rune-based composables outside a component context
 * is limited in Svelte 5, so we test the observable behavior through components.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Chart from '../Chart.svelte';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const barSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

describe('dark mode rendering', () => {
  it('renders without dark mode', async () => {
    const { container } = render(Chart, { props: { spec: barSpec } });
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('renders with dark mode off', async () => {
    const { container } = render(Chart, {
      props: { spec: barSpec, darkMode: 'off' },
    });
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('renders with dark mode forced', async () => {
    const { container } = render(Chart, {
      props: { spec: barSpec, darkMode: 'force' },
    });
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('renders with dark mode auto', async () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    const { container } = render(Chart, {
      props: { spec: barSpec, darkMode: 'auto' },
    });
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    spy.mockRestore();
  });

  it('switching dark mode re-renders chart', async () => {
    const { container, rerender } = render(Chart, {
      props: { spec: barSpec, darkMode: 'off' },
    });
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });

    await rerender({ spec: barSpec, darkMode: 'force' });
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });
});
