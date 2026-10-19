import type { ThemeConfig } from '../types/spec';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Merge configuration objects; color pairs, arrays and null are atomic leaves. */
export function mergeThemeObjects<T>(base: T, override: unknown): T {
  if (!isRecord(override) || 'light' in override || 'dark' in override) return override as T;
  const result: Record<string, unknown> = isRecord(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) result[key] = mergeThemeObjects(result[key], value);
  }
  return result as T;
}

function normalize(config: ThemeConfig): ThemeConfig {
  return Array.isArray(config.colors)
    ? { ...config, colors: { categorical: config.colors } }
    : config;
}

/** Deep-merge authored theme layers. Later layers win at each authored leaf. */
export function mergeThemeConfig(
  base: ThemeConfig | undefined,
  override: ThemeConfig | undefined,
): ThemeConfig | undefined {
  if (!override) return base;
  return mergeThemeObjects(base ? normalize(base) : {}, normalize(override));
}
