/**
 * Tests for VizThemeProvider and useVizTheme.
 *
 * Verifies that themes cascade through the provider hierarchy and that
 * nested providers override parent themes.
 */

import type { ThemeConfig } from '@openchart/core';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVizTheme, VizThemeProvider } from '../ThemeContext';

// ---------------------------------------------------------------------------
// Test harness components
// ---------------------------------------------------------------------------

function ThemeConsumer({ testId = 'theme-output' }: { testId?: string }) {
  const theme = useVizTheme();
  return <div data-testid={testId}>{theme ? JSON.stringify(theme) : 'no-theme'}</div>;
}

/** Render a ThemeConsumer and wait for it to appear in the DOM. */
async function renderTheme(jsx: React.ReactElement) {
  const result = render(jsx);
  await waitFor(() => {
    expect(result.container.querySelector('[data-testid]')).not.toBeNull();
  });
  return result;
}

// ---------------------------------------------------------------------------
// useVizTheme
// ---------------------------------------------------------------------------

describe('useVizTheme', () => {
  it('returns undefined when used outside of a provider', async () => {
    const { container } = await renderTheme(<ThemeConsumer />);
    const output = container.querySelector('[data-testid="theme-output"]');
    expect(output?.textContent).toBe('no-theme');
  });
});

// ---------------------------------------------------------------------------
// VizThemeProvider
// ---------------------------------------------------------------------------

describe('VizThemeProvider', () => {
  it('provides theme to child components', async () => {
    const theme: ThemeConfig = {
      colors: { categorical: ['#ff0000', '#00ff00', '#0000ff'] },
    };

    const { container } = await renderTheme(
      <VizThemeProvider theme={theme}>
        <ThemeConsumer />
      </VizThemeProvider>,
    );

    const output = container.querySelector('[data-testid="theme-output"]');
    const parsed = JSON.parse(output!.textContent!);
    expect(parsed.colors.categorical).toEqual(['#ff0000', '#00ff00', '#0000ff']);
  });

  it('provides undefined theme when passed undefined', async () => {
    const { container } = await renderTheme(
      <VizThemeProvider theme={undefined}>
        <ThemeConsumer />
      </VizThemeProvider>,
    );

    const output = container.querySelector('[data-testid="theme-output"]');
    expect(output?.textContent).toBe('no-theme');
  });

  it('nested providers override parent theme', async () => {
    const parentTheme: ThemeConfig = {
      colors: { categorical: ['#111'] },
      fonts: { family: 'Arial' },
    };

    const childTheme: ThemeConfig = {
      colors: { categorical: ['#222'] },
      borderRadius: 8,
    };

    const { container } = await renderTheme(
      <VizThemeProvider theme={parentTheme}>
        <VizThemeProvider theme={childTheme}>
          <ThemeConsumer />
        </VizThemeProvider>
      </VizThemeProvider>,
    );

    const output = container.querySelector('[data-testid="theme-output"]');
    const parsed = JSON.parse(output!.textContent!);

    // Inner provider completely replaces the context value (no merging)
    expect(parsed.colors.categorical).toEqual(['#222']);
    expect(parsed.borderRadius).toBe(8);
    // Parent-only fields are absent since inner provider replaces the value
    expect(parsed.fonts).toBeUndefined();
  });

  it('multiple consumers at different nesting levels receive correct themes', async () => {
    const outerTheme: ThemeConfig = {
      colors: { background: '#fff' },
    };

    const innerTheme: ThemeConfig = {
      colors: { background: '#000' },
    };

    const result = render(
      <VizThemeProvider theme={outerTheme}>
        <ThemeConsumer testId="outer-theme" />
        <VizThemeProvider theme={innerTheme}>
          <ThemeConsumer testId="inner-theme" />
        </VizThemeProvider>
      </VizThemeProvider>,
    );

    await waitFor(() => {
      expect(result.container.querySelector('[data-testid="outer-theme"]')).not.toBeNull();
      expect(result.container.querySelector('[data-testid="inner-theme"]')).not.toBeNull();
    });

    const outerParsed = JSON.parse(
      result.container.querySelector('[data-testid="outer-theme"]')!.textContent!,
    );
    const innerParsed = JSON.parse(
      result.container.querySelector('[data-testid="inner-theme"]')!.textContent!,
    );

    expect(outerParsed.colors.background).toBe('#fff');
    expect(innerParsed.colors.background).toBe('#000');
  });

  it('theme updates propagate to consumers', async () => {
    const theme1: ThemeConfig = { borderRadius: 4 };
    const theme2: ThemeConfig = { borderRadius: 12 };

    const { container, rerender } = await renderTheme(
      <VizThemeProvider theme={theme1}>
        <ThemeConsumer />
      </VizThemeProvider>,
    );

    const parsed1 = JSON.parse(
      container.querySelector('[data-testid="theme-output"]')!.textContent!,
    );
    expect(parsed1.borderRadius).toBe(4);

    rerender(
      <VizThemeProvider theme={theme2}>
        <ThemeConsumer />
      </VizThemeProvider>,
    );

    await waitFor(() => {
      const parsed2 = JSON.parse(
        container.querySelector('[data-testid="theme-output"]')!.textContent!,
      );
      expect(parsed2.borderRadius).toBe(12);
    });
  });
});
