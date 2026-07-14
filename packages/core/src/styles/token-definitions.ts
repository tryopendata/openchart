export interface CssTokenDef {
  name: string;
  light: string;
  dark?: string;
  comment?: string;
  consumers?: string;
  section?: string;
}

export const CSS_TOKEN_ROOT_SELECTORS: readonly string[] = [
  '.oc-root',
  '.oc-chart-root',
  '.oc-table-wrapper',
  '.oc-table-root',
  '.oc-graph-wrapper',
  '.oc-graph-root',
  '.oc-sankey-root',
  '.oc-tilemap-root',
  '.oc-barlist-root',
  '.oc-map-root',
];

/**
 * Text levels. Names invert across modes: in light mode "muted" sits at
 * a lighter zinc step than "subtle" because both are picked relative to
 * the active background, not from a fixed lightness ladder. The intent
 * is "muted = first step away from primary text"; "subtle = next step
 * down"; etc.
 *
 *   Light mode: text=zinc-950, secondary=zinc-700, muted=zinc-500,
 *               subtle=zinc-400, faint=zinc-300
 *   Dark mode (dark.css): inverts the surface tokens but keeps the same
 *               muted -> subtle -> faint progression away from primary.
 */

export const CSS_TOKENS: readonly CssTokenDef[] = [
  {
    name: '--oc-font-family',
    light:
      '\n      "Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    name: '--oc-font-mono',
    light: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },

  {
    section: 'Animation easing presets via CSS linear()',
    name: '--oc-ease-smooth',
    light:
      'linear(\n      0,\n      0.157,\n      0.438,\n      0.64,\n      0.766,\n      0.85,\n      0.906,\n      0.941,\n      0.964,\n      0.978,\n      0.988,\n      0.994,\n      0.998,\n      1\n    )',
  },
  {
    name: '--oc-ease-snappy',
    light:
      'linear(\n      0,\n      0.012,\n      0.048,\n      0.108,\n      0.194,\n      0.302,\n      0.426,\n      0.559,\n      0.69,\n      0.808,\n      0.905,\n      0.973,\n      1.013,\n      1.028,\n      1.023,\n      1.006,\n      0.984,\n      0.966,\n      0.957,\n      0.957,\n      0.964,\n      0.975,\n      0.986,\n      0.995,\n      1,\n      1.003,\n      1.002,\n      1,\n      0.998,\n      0.998,\n      0.999,\n      1\n    )',
    consumers: 'EASE_VAR_MAP in vanilla renderers',
  },

  { section: 'Animation timing defaults', name: '--oc-animation-duration', light: '500ms' },
  { name: '--oc-animation-stagger', light: '80ms' },
  { name: '--oc-annotation-delay', light: '200ms' },

  { section: 'Typography scale (editorial design system)', name: '--oc-title-size', light: '26px' },
  { name: '--oc-title-weight', light: '590' },
  { name: '--oc-title-tracking', light: '-0.022em' },
  { name: '--oc-subtitle-size', light: '14px' },
  { name: '--oc-subtitle-weight', light: '450' },
  { name: '--oc-source-size', light: '11px' },
  { name: '--oc-source-weight', light: '450' },
  { name: '--oc-body-size', light: '13px' },
  { name: '--oc-eyebrow-size', light: '11px' },
  { name: '--oc-eyebrow-weight', light: '550' },
  { name: '--oc-eyebrow-tracking', light: '0.08em' },

  { section: 'Surfaces (light mode defaults)', name: '--oc-bg', light: '#ffffff', dark: '#09090b' },
  { name: '--oc-card', light: '#ffffff', dark: '#111113' },
  {
    name: '--oc-secondary',
    light: '#f4f4f5',
    dark: '#27272a',
    comment: 'zinc-100, raised surface',
  },

  {
    section: `Text levels. Names invert across modes: in light mode "muted" sits at
   * a lighter zinc step than "subtle" because both are picked relative to
   * the active background, not from a fixed lightness ladder. The intent
   * is "muted = first step away from primary text"; "subtle = next step
   * down"; etc.
   *
   *   Light mode: text=zinc-950, secondary=zinc-700, muted=zinc-500,
   *               subtle=zinc-400, faint=zinc-300
   *   Dark mode (dark.css): inverts the surface tokens but keeps the same
   *               muted -> subtle -> faint progression away from primary.`,
    name: '--oc-text',
    light: '#09090b',
    dark: '#f7f8f8',
  },
  { name: '--oc-text-secondary', light: '#3f3f46', dark: '#d0d6e0' },
  { name: '--oc-text-muted', light: '#71717a', dark: '#a1a1aa' },
  { name: '--oc-text-faint', light: '#d4d4d8', dark: '#52525b' },

  {
    section: 'Lines',
    name: '--oc-gridline',
    light: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(255, 255, 255, 0.05)',
  },
  {
    name: '--oc-axis',
    light: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(255, 255, 255, 0.1)',
  },
  {
    name: '--oc-border',
    light: 'rgba(0, 0, 0, 0.08)',
    dark: 'rgba(255, 255, 255, 0.1)',
  },
  { name: '--oc-border-radius', light: '2px' },

  {
    section: 'Brand and semantic',
    name: '--oc-accent',
    light: '#06b6d4',
    dark: '#06b6d4',
  },
  {
    name: '--oc-accent-strong',
    light: '#0891b2',
    dark: '#06b6d4',
    comment: 'darker cyan for line strokes on light bg',
    consumers: 'stamped via adaptForLightLineStroke',
  },
  { name: '--oc-positive', light: '#10b981', dark: '#34d399' },
  { name: '--oc-negative', light: '#e11d48', dark: '#fb7185' },
  { name: '--oc-focus', light: '#3b82f6', dark: '#60a5fa' },
  {
    name: '--oc-focus-ring',
    light: 'rgba(59, 130, 246, 0.1)',
    comment: 'static, intentionally NOT derived from --oc-focus and NOT flipped in dark mode',
  },
  {
    name: '--oc-focus-ring-strong',
    light: 'rgba(59, 130, 246, 0.25)',
  },
  {
    name: '--oc-editable-hover',
    light: 'rgba(79, 70, 229, 0.35)',
    comment: 'edit-mode hover outline, indigo one-off',
  },

  {
    section: 'Spacing scale (4px base) — only --oc-space-2/4 are consumed (JS-stamped)',
    name: '--oc-space-2',
    light: '8px',
    consumers:
      'stamped at mount from theme.spacing (theme-tokens.ts); component CSS must NOT consume these',
  },
  {
    name: '--oc-space-4',
    light: '16px',
    consumers:
      'stamped at mount from theme.spacing (theme-tokens.ts); component CSS must NOT consume these',
  },

  {
    section: 'Interactive states',
    name: '--oc-hover-bg',
    light: 'rgba(0, 0, 0, 0.025)',
    dark: 'rgba(255, 255, 255, 0.05)',
  },
  {
    name: '--oc-tooltip-bg',
    light: 'rgba(255, 255, 255, 0.88)',
    dark: 'rgba(17, 17, 19, 0.92)',
  },
  {
    name: '--oc-tooltip-border',
    light: 'rgba(0, 0, 0, 0.08)',
    dark: 'rgba(255, 255, 255, 0.08)',
  },
  {
    name: '--oc-tooltip-shadow',
    light: '0 2px 8px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.12)',
    dark: '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.4)',
  },
  { name: '--oc-tooltip-text', light: '#09090b', dark: '#f7f8f8' },
  { name: '--oc-legend-text', light: '#3f3f46', dark: '#d0d6e0' },
];

const TOKEN_MAP = new Map(CSS_TOKENS.map((t) => [t.name, t]));

export function cssTokenDefault(name: string, mode: 'light' | 'dark'): string {
  const token = TOKEN_MAP.get(name);
  if (!token) throw new Error(`Unknown CSS token: ${name}`);
  if (mode === 'dark' && token.dark !== undefined) return token.dark;
  return token.light;
}
