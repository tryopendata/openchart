/**
 * Tests for useDarkMode composable.
 *
 * Uses thin wrapper components that expose composable state via the DOM,
 * then asserts using mount + flushPromises.
 */

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { useDarkMode } from '../composables/useDarkMode';

// ---------------------------------------------------------------------------
// useDarkMode
// ---------------------------------------------------------------------------

const DarkModeHarness = defineComponent({
  props: {
    mode: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    const modeRef = ref(props.mode as 'auto' | 'force' | 'off' | undefined);

    // Watch for prop changes (Vue test-utils setProps updates props but not our ref)
    // We need to use a computed or watchEffect to keep in sync
    const isDark = useDarkMode(modeRef);

    return { isDark, modeRef };
  },
  render() {
    return h('div', { 'data-testid': 'dark-mode' }, String(this.isDark));
  },
});

// A version of the harness that allows mode changes via exposed methods
const DarkModeInteractiveHarness = defineComponent({
  props: {
    initialMode: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    const modeRef = ref(props.initialMode as 'auto' | 'force' | 'off' | undefined);
    const isDark = useDarkMode(modeRef);

    return { isDark, modeRef };
  },
  render() {
    return h('div', [
      h('div', { 'data-testid': 'dark-mode' }, String(this.isDark)),
      h(
        'button',
        {
          'data-testid': 'set-force',
          onClick: () => {
            this.modeRef = 'force';
          },
        },
        'Force',
      ),
      h(
        'button',
        {
          'data-testid': 'set-off',
          onClick: () => {
            this.modeRef = 'off';
          },
        },
        'Off',
      ),
    ]);
  },
});

describe('useDarkMode', () => {
  it('returns false when no mode is provided', async () => {
    const wrapper = mount(DarkModeHarness);
    await flushPromises();

    expect(wrapper.find('[data-testid="dark-mode"]').text()).toBe('false');
    wrapper.unmount();
  });

  it('returns false for "off" mode', async () => {
    const wrapper = mount(DarkModeHarness, { props: { mode: 'off' } });
    await flushPromises();

    expect(wrapper.find('[data-testid="dark-mode"]').text()).toBe('false');
    wrapper.unmount();
  });

  it('returns true for "force" mode', async () => {
    const wrapper = mount(DarkModeHarness, { props: { mode: 'force' } });
    await flushPromises();

    expect(wrapper.find('[data-testid="dark-mode"]').text()).toBe('true');
    wrapper.unmount();
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

    const wrapper = mount(DarkModeHarness, { props: { mode: 'auto' } });
    await flushPromises();

    expect(wrapper.find('[data-testid="dark-mode"]').text()).toBe('true');

    spy.mockRestore();
    wrapper.unmount();
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

    const wrapper = mount(DarkModeHarness, { props: { mode: 'auto' } });
    await flushPromises();

    expect(wrapper.find('[data-testid="dark-mode"]').text()).toBe('false');

    spy.mockRestore();
    wrapper.unmount();
  });

  it('switches from "off" to "force" when mode changes', async () => {
    const wrapper = mount(DarkModeInteractiveHarness, {
      props: { initialMode: 'off' },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="dark-mode"]').text()).toBe('false');

    await wrapper.find('[data-testid="set-force"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="dark-mode"]').text()).toBe('true');
    wrapper.unmount();
  });
});
