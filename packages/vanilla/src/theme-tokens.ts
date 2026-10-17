/**
 * Project authored theme leaves to scoped CSS custom properties.
 *
 * Unauthored values remain in tokens.css / dark.css, leaving host CSS in
 * control. Derived neutral values follow authored text/background changes.
 */

import type { ResolvedTheme, ThemeConfig } from '@opendata-ai/openchart-core';
import { adaptForLightLineStroke, cssTokenDefault } from '@opendata-ai/openchart-core';

/**
 * The opaque surface a theme paints on. A transparent theme background has no
 * color of its own, so it resolves to the static `--oc-bg` token for the mode --
 * the same value the engine's knockout strokes are cut in. Resolved once in
 * core, on `colors.neutral.surface`; this is a named read of it.
 */
export function resolvedSurface(theme: ResolvedTheme): string {
  return theme.colors.neutral.surface;
}

type StyledElement = HTMLElement | SVGElement;
const stamped = new WeakMap<
  StyledElement,
  Map<string, { previous: string; priority: string; value: string }>
>();

/** Stamp only authored theme leaves. Defaults stay in CSS so host rules can override them. */
export function stampThemeProperties(
  el: StyledElement,
  theme: ResolvedTheme,
  kind?: 'table',
): void {
  el.classList.toggle('oc-dark', theme.isDark);
  const accent = theme.colors.categorical[0] ?? cssTokenDefault('--oc-accent', 'light');
  const bg = resolvedSurface(theme);

  const n = theme.colors.neutral;

  const props: [string, string][] = [
    ['--oc-font-family', theme.fonts.family],
    ['--oc-font-mono', theme.fonts.mono],
    ['--oc-title-size', `${theme.chrome.title.fontSize}px`],
    ['--oc-title-weight', `${theme.chrome.title.fontWeight}`],
    ['--oc-subtitle-size', `${theme.chrome.subtitle.fontSize}px`],
    ['--oc-subtitle-weight', `${theme.chrome.subtitle.fontWeight}`],
    ['--oc-source-size', `${theme.chrome.source.fontSize}px`],
    ['--oc-source-weight', `${theme.chrome.source.fontWeight}`],
    ['--oc-body-size', `${theme.fonts.sizes.body}px`],
    ['--oc-eyebrow-size', `${theme.chrome.eyebrow.fontSize}px`],
    ['--oc-eyebrow-weight', `${theme.chrome.eyebrow.fontWeight}`],
    ['--oc-bg', bg],
    ['--oc-text', theme.colors.text],
    ['--oc-text-muted', theme.colors.axis],
    // Secondary grays are derived from the theme's own text/background pair
    // (ResolvedTheme.colors.neutral), so a warm or cool theme gets warm or
    // cool grays instead of zinc. One direction only: theme -> CSS.
    ['--oc-text-secondary', n.secondary],
    ['--oc-text-faint', n.faint],
    ['--oc-border', n.border],
    ['--oc-gray-100', n[100]],
    ['--oc-gray-200', n[200]],
    ['--oc-gray-300', n[300]],
    ['--oc-gray-400', n[400]],
    ['--oc-gray-600', n[600]],
    ['--oc-gray-800', n[800]],
    ['--oc-gridline', theme.colors.gridline],
    // --oc-axis is the hairline the axis line is drawn with, not the ink its
    // tick labels take (that is --oc-text-muted, above).
    ['--oc-axis', theme.colors.hairline],
    ['--oc-border-radius', `${theme.borderRadius}px`],
    ['--oc-accent', accent],
    ['--oc-accent-strong', adaptForLightLineStroke(accent)],
    ['--oc-positive', theme.colors.positive],
    ['--oc-negative', theme.colors.negative],
    ['--oc-space-2', `${theme.spacing.chromeGap * 2}px`],
    ['--oc-space-4', `${theme.spacing.padding}px`],
  ];

  const authored = theme._authored;
  const colors = authored?.colors && !Array.isArray(authored.colors) ? authored.colors : {};
  const neutralAuthored = colors.text !== undefined || colors.background !== undefined;
  const colorAuthored = (key: keyof Exclude<ThemeConfig['colors'], string[] | undefined>) =>
    colors[key] !== undefined;
  const chromeAuthored = (
    element: 'title' | 'subtitle' | 'source' | 'eyebrow',
    field: 'fontSize' | 'fontWeight',
  ) => {
    if (authored?.chrome?.[element]?.[field] !== undefined) return true;
    if (field === 'fontWeight' || element === 'eyebrow') return false;
    return authored?.fonts?.sizes?.[element === 'source' ? 'small' : element] !== undefined;
  };
  const paletteAuthored = Array.isArray(authored?.colors) || colors.categorical !== undefined;
  const enabled: Record<string, boolean> = {
    '--oc-font-family': authored?.fonts?.family !== undefined,
    '--oc-font-mono': authored?.fonts?.mono !== undefined,
    '--oc-title-size': chromeAuthored('title', 'fontSize'),
    '--oc-title-weight': chromeAuthored('title', 'fontWeight'),
    '--oc-subtitle-size': chromeAuthored('subtitle', 'fontSize'),
    '--oc-subtitle-weight': chromeAuthored('subtitle', 'fontWeight'),
    '--oc-source-size': chromeAuthored('source', 'fontSize'),
    '--oc-source-weight': chromeAuthored('source', 'fontWeight'),
    '--oc-body-size': authored?.fonts?.sizes?.body !== undefined,
    '--oc-eyebrow-size': chromeAuthored('eyebrow', 'fontSize'),
    '--oc-eyebrow-weight': chromeAuthored('eyebrow', 'fontWeight'),
    '--oc-bg': colorAuthored('background'),
    '--oc-text': colorAuthored('text'),
    '--oc-text-muted': colorAuthored('axis') || (kind === 'table' && neutralAuthored),
    '--oc-text-secondary': neutralAuthored,
    '--oc-text-faint': neutralAuthored,
    '--oc-border': neutralAuthored || (kind === 'table' && colorAuthored('gridline')),
    '--oc-gridline': colorAuthored('gridline'),
    '--oc-axis': colorAuthored('hairline'),
    '--oc-border-radius': authored?.borderRadius !== undefined,
    '--oc-accent': paletteAuthored,
    '--oc-accent-strong': paletteAuthored,
    '--oc-positive': colorAuthored('positive'),
    '--oc-negative': colorAuthored('negative'),
    '--oc-space-2': authored?.spacing?.chromeGap !== undefined,
    '--oc-space-4': authored?.spacing?.padding !== undefined,
  };
  for (const key of [
    'annotationLabel',
    'annotationMuted',
    'annotationLeader',
    'annotationRule',
    'annotationRangeFill',
    'annotationMarkerFill',
    'annotationPlate',
  ] as const) {
    const name = `--oc-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    props.push([name, theme.colors[key]]);
    enabled[name] =
      colorAuthored(key) ||
      ((key === 'annotationMarkerFill' || key === 'annotationPlate') && neutralAuthored);
  }
  for (const level of [100, 200, 300, 400, 600, 800])
    enabled[`--oc-gray-${level}`] = neutralAuthored;
  if (kind === 'table') {
    if (!colorAuthored('axis')) props.find(([name]) => name === '--oc-text-muted')![1] = n[600];
    if (colorAuthored('gridline'))
      props.find(([name]) => name === '--oc-border')![1] = theme.colors.gridline;
  }
  const previous = stamped.get(el) ?? new Map();
  for (const [name, entry] of previous) {
    if (!enabled[name]) {
      // Do not erase a host change made since our last stamp.
      if (el.style.getPropertyValue(name) === entry.value) {
        if (entry.previous) el.style.setProperty(name, entry.previous, entry.priority);
        else el.style.removeProperty(name);
      }
      previous.delete(name);
    }
  }
  for (const [name, value] of props) {
    if (!enabled[name]) continue;
    const old = previous.get(name);
    previous.set(name, {
      previous: old?.previous ?? el.style.getPropertyValue(name),
      priority: old?.priority ?? el.style.getPropertyPriority(name),
      value,
    });
    el.style.setProperty(name, value);
  }
  stamped.set(el, previous);
}
