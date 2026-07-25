import type { DarkMode } from '@opendata-ai/openchart-core';

/**
 * Resolve a DarkMode option to a boolean. 'auto' consults the OS preference
 * via matchMedia; environments without matchMedia (SSR, happy-dom) resolve
 * to light.
 */
export function resolveDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}
