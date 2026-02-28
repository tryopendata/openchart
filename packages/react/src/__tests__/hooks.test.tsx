/**
 * Tests for useChart and useDarkMode hooks.
 *
 * Note: renderHook from @testing-library/react doesn't work in this project
 * due to bun's React dual-instance issue (renderHook's internal TestComponent
 * uses a different React copy than the hooks under test). Instead, we render
 * thin wrapper components that expose hook state via the DOM, then assert
 * using render + waitFor.
 */

import type { ChartSpec } from '@openchart/core';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChart, useDarkMode } from '../hooks';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const barSpec: ChartSpec = {
  type: 'bar',
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
// useDarkMode
// ---------------------------------------------------------------------------

function DarkModeHarness({ mode }: { mode?: 'auto' | 'force' | 'off' }) {
  const isDark = useDarkMode(mode);
  return <div data-testid="dark-mode">{String(isDark)}</div>;
}

describe('useDarkMode', () => {
  it('returns false when no mode is provided', async () => {
    const { container } = render(<DarkModeHarness />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dark-mode"]')?.textContent).toBe('false');
    });
  });

  it('returns false for "off" mode', async () => {
    const { container } = render(<DarkModeHarness mode="off" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dark-mode"]')?.textContent).toBe('false');
    });
  });

  it('returns true for "force" mode', async () => {
    const { container } = render(<DarkModeHarness mode="force" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dark-mode"]')?.textContent).toBe('true');
    });
  });

  it('reflects system preference for "auto" mode when dark', async () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    const { container } = render(<DarkModeHarness mode="auto" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dark-mode"]')?.textContent).toBe('true');
    });

    spy.mockRestore();
  });

  it('reflects system preference for "auto" mode when light', async () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    const { container } = render(<DarkModeHarness mode="auto" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dark-mode"]')?.textContent).toBe('false');
    });

    spy.mockRestore();
  });

  it('switches from "off" to "force" when mode prop changes', async () => {
    const { container, rerender } = render(<DarkModeHarness mode="off" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dark-mode"]')?.textContent).toBe('false');
    });

    rerender(<DarkModeHarness mode="force" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dark-mode"]')?.textContent).toBe('true');
    });
  });
});

// ---------------------------------------------------------------------------
// useChart
// ---------------------------------------------------------------------------

function ChartHookHarness({ spec }: { spec: ChartSpec }) {
  const { ref, chart, layout } = useChart(spec);
  return (
    <div>
      <div ref={ref} data-testid="chart-container" />
      <span data-testid="has-chart">{String(chart !== null)}</span>
      <span data-testid="has-layout">{String(layout !== null)}</span>
    </div>
  );
}

describe('useChart', () => {
  it('mounts a chart instance into the ref container', async () => {
    const { container } = render(<ChartHookHarness spec={barSpec} />);

    await waitFor(() => {
      const chartContainer = container.querySelector('[data-testid="chart-container"]');
      const svg = chartContainer?.querySelector('svg');
      expect(svg).not.toBeNull();
    });
  });

  it('produces a non-null layout after mounting', async () => {
    const { container } = render(<ChartHookHarness spec={barSpec} />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="has-layout"]')?.textContent).toBe('true');
    });
  });

  it('cleans up the chart on unmount', async () => {
    const { container, unmount } = render(<ChartHookHarness spec={barSpec} />);

    await waitFor(() => {
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    unmount();

    expect(container.querySelector('svg')).toBeNull();
  });
});
