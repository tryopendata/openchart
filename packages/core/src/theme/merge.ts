import type { ThemeConfig } from '../types/spec';

/** Merge authored theme layers with v8 shallow precedence (later layers win). */
export function mergeThemeConfig(
  base: ThemeConfig | undefined,
  override: ThemeConfig | undefined,
): ThemeConfig | undefined {
  return override ? { ...base, ...override } : base;
}
