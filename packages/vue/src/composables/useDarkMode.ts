/**
 * useDarkMode: composable that resolves a DarkMode preference to a boolean.
 *
 * - "force" -> true
 * - "off" -> false
 * - "auto" -> matches system preference (reactive to changes)
 */

import type { DarkMode } from '@openchart/core';
import { onUnmounted, type Ref, ref, watch } from 'vue';

/**
 * Resolve a DarkMode preference to a reactive boolean.
 *
 * For "auto" mode, watches the system `prefers-color-scheme` media query
 * and updates reactively when the user changes their OS theme.
 */
export function useDarkMode(mode: Ref<DarkMode | undefined>): Ref<boolean> {
  const isDark = ref(resolveInitial(mode.value));
  let cleanup: (() => void) | null = null;

  function setup(currentMode: DarkMode | undefined) {
    // Clean up previous listener
    cleanup?.();
    cleanup = null;

    if (currentMode !== 'auto') {
      isDark.value = currentMode === 'force';
      return;
    }

    if (typeof window === 'undefined' || !window.matchMedia) {
      isDark.value = false;
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    isDark.value = mq.matches;

    const handler = (e: MediaQueryListEvent) => {
      isDark.value = e.matches;
    };
    mq.addEventListener('change', handler);
    cleanup = () => mq.removeEventListener('change', handler);
  }

  // Run setup for initial value
  setup(mode.value);

  // React to mode changes
  watch(mode, (newMode) => {
    setup(newMode);
  });

  onUnmounted(() => {
    cleanup?.();
    cleanup = null;
  });

  return isDark;
}

function resolveInitial(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  // "auto"
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}
