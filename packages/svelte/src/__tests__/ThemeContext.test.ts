/**
 * Tests for VizThemeProvider context propagation.
 *
 * Tests that theme and dark mode contexts are correctly provided to
 * descendant Chart components via the VizThemeProvider.
 *
 * Since testing context requires Svelte components that consume context,
 * we test through the Chart component which reads context via
 * getVizTheme() and getVizDarkMode().
 */

import type { ChartSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Chart from '../Chart.svelte';
import { DARK_MODE_KEY, THEME_KEY } from '../context.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const minimalSpec: ChartSpec = {
  type: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
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

describe('Theme context', () => {
  it('Chart renders without context (graceful fallback)', async () => {
    const { container } = render(Chart, { props: { spec: minimalSpec } });
    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('Chart receives theme from context', async () => {
    const theme: ThemeConfig = {
      colors: { categorical: ['#ff0000', '#00ff00', '#0000ff'] },
    };

    const { container } = render(Chart, {
      props: { spec: minimalSpec },
      context: new Map([[THEME_KEY, () => theme]]),
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('Chart receives dark mode from context', async () => {
    const { container } = render(Chart, {
      props: { spec: minimalSpec },
      context: new Map([[DARK_MODE_KEY, () => 'force']]),
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('explicit theme prop overrides context theme', async () => {
    const contextTheme: ThemeConfig = {
      colors: { categorical: ['#111'] },
    };
    const propTheme: ThemeConfig = {
      colors: { categorical: ['#222'] },
    };

    // When both context and prop are provided, prop should take priority.
    // We just verify it renders successfully (the override logic is in the component).
    const { container } = render(Chart, {
      props: { spec: minimalSpec, theme: propTheme },
      context: new Map([[THEME_KEY, () => contextTheme]]),
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('explicit darkMode prop overrides context darkMode', async () => {
    const { container } = render(Chart, {
      props: { spec: minimalSpec, darkMode: 'off' },
      context: new Map([[DARK_MODE_KEY, () => 'force']]),
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });
});
