/**
 * useDarkMode: resolve a DarkMode preference to a boolean.
 *
 * - "force" -> true
 * - "off" -> false
 * - "auto" -> matches system preference (reactive to changes)
 *
 * Uses .svelte.ts extension so runes ($state, $effect) work outside
 * .svelte components.
 */

import type { DarkMode } from '@opendata-ai/core';

export function useDarkMode(mode: () => DarkMode | undefined) {
  let isDark = $state(resolveInitial(mode()));

  $effect(() => {
    const m = mode();
    if (m !== 'auto') {
      isDark = m === 'force';
      return;
    }
    if (typeof window === 'undefined' || !window.matchMedia) {
      isDark = false;
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    isDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      isDark = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  return {
    get isDark() {
      return isDark;
    },
  };
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
