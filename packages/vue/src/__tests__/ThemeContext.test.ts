/**
 * Tests for VizThemeProvider, useVizTheme, and useVizDarkMode.
 *
 * Verifies that themes and dark mode preferences cascade through the
 * provider hierarchy and that nested providers override parent values.
 */

import type { ThemeConfig } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { useVizDarkMode, useVizTheme } from '../context';
import { VizThemeProvider } from '../ThemeProvider';

// ---------------------------------------------------------------------------
// Test harness components
// ---------------------------------------------------------------------------

const ThemeConsumer = defineComponent({
  props: {
    testId: {
      type: String,
      default: 'theme-output',
    },
  },
  setup(props) {
    const theme = useVizTheme();
    return () =>
      h(
        'div',
        { 'data-testid': props.testId },
        theme.value ? JSON.stringify(theme.value) : 'no-theme',
      );
  },
});

const DarkModeConsumer = defineComponent({
  props: {
    testId: {
      type: String,
      default: 'darkmode-output',
    },
  },
  setup(props) {
    const darkMode = useVizDarkMode();
    return () => h('div', { 'data-testid': props.testId }, darkMode.value ?? 'undefined');
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findByTestId(wrapper: ReturnType<typeof mount>, testId: string) {
  return wrapper.find(`[data-testid="${testId}"]`);
}

// ---------------------------------------------------------------------------
// useVizTheme
// ---------------------------------------------------------------------------

describe('useVizTheme', () => {
  it('returns undefined when used outside of a provider', async () => {
    const wrapper = mount(ThemeConsumer);
    await flushPromises();

    const output = findByTestId(wrapper, 'theme-output');
    expect(output.text()).toBe('no-theme');
    wrapper.unmount();
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

    const wrapper = mount(VizThemeProvider, {
      props: { theme },
      slots: { default: () => h(ThemeConsumer) },
    });
    await flushPromises();

    const output = findByTestId(wrapper, 'theme-output');
    const parsed = JSON.parse(output.text());
    expect(parsed.colors.categorical).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    wrapper.unmount();
  });

  it('provides undefined theme when passed undefined', async () => {
    const wrapper = mount(VizThemeProvider, {
      props: { theme: undefined },
      slots: { default: () => h(ThemeConsumer) },
    });
    await flushPromises();

    const output = findByTestId(wrapper, 'theme-output');
    expect(output.text()).toBe('no-theme');
    wrapper.unmount();
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

    const TestApp = defineComponent({
      setup() {
        return () =>
          h(VizThemeProvider, { theme: parentTheme }, () =>
            h(VizThemeProvider, { theme: childTheme }, () => h(ThemeConsumer)),
          );
      },
    });

    const wrapper = mount(TestApp);
    await flushPromises();

    const output = findByTestId(wrapper, 'theme-output');
    const parsed = JSON.parse(output.text());

    // Inner provider completely replaces the context value (no merging)
    expect(parsed.colors.categorical).toEqual(['#222']);
    expect(parsed.borderRadius).toBe(8);
    // Parent-only fields are absent since inner provider replaces the value
    expect(parsed.fonts).toBeUndefined();
    wrapper.unmount();
  });

  it('multiple consumers at different nesting levels receive correct themes', async () => {
    const outerTheme: ThemeConfig = {
      colors: { background: '#fff' },
    };

    const innerTheme: ThemeConfig = {
      colors: { background: '#000' },
    };

    const TestApp = defineComponent({
      setup() {
        return () =>
          h(VizThemeProvider, { theme: outerTheme }, () => [
            h(ThemeConsumer, { testId: 'outer-theme' }),
            h(VizThemeProvider, { theme: innerTheme }, () =>
              h(ThemeConsumer, { testId: 'inner-theme' }),
            ),
          ]);
      },
    });

    const wrapper = mount(TestApp);
    await flushPromises();

    const outerParsed = JSON.parse(findByTestId(wrapper, 'outer-theme').text());
    const innerParsed = JSON.parse(findByTestId(wrapper, 'inner-theme').text());

    expect(outerParsed.colors.background).toBe('#fff');
    expect(innerParsed.colors.background).toBe('#000');
    wrapper.unmount();
  });

  it('theme updates propagate to consumers', async () => {
    const theme1: ThemeConfig = { borderRadius: 4 };
    const theme2: ThemeConfig = { borderRadius: 12 };

    const wrapper = mount(VizThemeProvider, {
      props: { theme: theme1 },
      slots: { default: () => h(ThemeConsumer) },
    });
    await flushPromises();

    const parsed1 = JSON.parse(findByTestId(wrapper, 'theme-output').text());
    expect(parsed1.borderRadius).toBe(4);

    await wrapper.setProps({ theme: theme2 });
    await flushPromises();

    const parsed2 = JSON.parse(findByTestId(wrapper, 'theme-output').text());
    expect(parsed2.borderRadius).toBe(12);
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// useVizDarkMode
// ---------------------------------------------------------------------------

describe('useVizDarkMode', () => {
  it('returns undefined when used outside of a provider', async () => {
    const wrapper = mount(DarkModeConsumer);
    await flushPromises();

    const output = findByTestId(wrapper, 'darkmode-output');
    expect(output.text()).toBe('undefined');
    wrapper.unmount();
  });

  it('returns the darkMode value from provider', async () => {
    const wrapper = mount(VizThemeProvider, {
      props: { theme: undefined, darkMode: 'force' },
      slots: { default: () => h(DarkModeConsumer) },
    });
    await flushPromises();

    const output = findByTestId(wrapper, 'darkmode-output');
    expect(output.text()).toBe('force');
    wrapper.unmount();
  });

  it('returns undefined when provider omits darkMode', async () => {
    const wrapper = mount(VizThemeProvider, {
      props: { theme: undefined },
      slots: { default: () => h(DarkModeConsumer) },
    });
    await flushPromises();

    const output = findByTestId(wrapper, 'darkmode-output');
    expect(output.text()).toBe('undefined');
    wrapper.unmount();
  });

  it('nested provider overrides parent darkMode', async () => {
    const TestApp = defineComponent({
      setup() {
        return () =>
          h(VizThemeProvider, { theme: undefined, darkMode: 'force' }, () =>
            h(VizThemeProvider, { theme: undefined, darkMode: 'off' }, () => h(DarkModeConsumer)),
          );
      },
    });

    const wrapper = mount(TestApp);
    await flushPromises();

    const output = findByTestId(wrapper, 'darkmode-output');
    expect(output.text()).toBe('off');
    wrapper.unmount();
  });

  it('darkMode updates propagate to consumers', async () => {
    const wrapper = mount(VizThemeProvider, {
      props: { theme: undefined, darkMode: 'off' },
      slots: { default: () => h(DarkModeConsumer) },
    });
    await flushPromises();

    expect(findByTestId(wrapper, 'darkmode-output').text()).toBe('off');

    await wrapper.setProps({ darkMode: 'force' });
    await flushPromises();

    expect(findByTestId(wrapper, 'darkmode-output').text()).toBe('force');
    wrapper.unmount();
  });
});
