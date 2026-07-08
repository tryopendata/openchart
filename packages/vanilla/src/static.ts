import { createRequire } from 'node:module';
import type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  DarkMode,
  LayerSpec,
  ResolvedTheme,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { adaptForLightLineStroke, isLayerSpec } from '@opendata-ai/openchart-core';
import { compileChart, compileLayer } from '@opendata-ai/openchart-engine';
import { resetSvgIdCounter } from './svg-ids';
import { renderChartSVG } from './svg-renderer';

const esmRequire = createRequire(import.meta.url);

export interface StaticRenderOptions {
  width?: number;
  height?: number;
  theme?: ThemeConfig;
  /**
   * Dark mode setting. In static rendering `'auto'` resolves to light mode
   * since there is no `matchMedia` to query. Use `'force'` for dark output.
   */
  darkMode?: DarkMode;
  watermark?: boolean;
}

function resolveStaticDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  return false;
}

function buildThemeStyleBlock(theme: ResolvedTheme): string {
  const accent = theme.colors.categorical[0] ?? '#06b6d4';
  const bg =
    theme.colors.background === 'transparent'
      ? theme.isDark
        ? '#09090b'
        : '#ffffff'
      : theme.colors.background;

  const props = [
    `--oc-font-family: ${theme.fonts.family}`,
    `--oc-font-mono: ${theme.fonts.mono}`,
    `--oc-title-size: ${theme.chrome.title.fontSize}px`,
    `--oc-title-weight: ${theme.chrome.title.fontWeight}`,
    `--oc-title-tracking: -0.022em`,
    `--oc-subtitle-size: ${theme.chrome.subtitle.fontSize}px`,
    `--oc-subtitle-weight: ${theme.chrome.subtitle.fontWeight}`,
    `--oc-source-size: ${theme.chrome.source.fontSize}px`,
    `--oc-source-weight: ${theme.chrome.source.fontWeight}`,
    `--oc-body-size: ${theme.fonts.sizes.body}px`,
    `--oc-eyebrow-size: ${theme.chrome.eyebrow.fontSize}px`,
    `--oc-eyebrow-weight: ${theme.chrome.eyebrow.fontWeight}`,
    `--oc-eyebrow-tracking: 0.08em`,
    `--oc-bg: ${bg}`,
    `--oc-text: ${theme.colors.text}`,
    `--oc-text-muted: ${theme.colors.axis}`,
    `--oc-text-faint: ${theme.isDark ? '#52525b' : '#d4d4d8'}`,
    `--oc-gridline: ${theme.colors.gridline}`,
    `--oc-axis: ${theme.colors.axis}`,
    `--oc-border-radius: ${theme.borderRadius}px`,
    `--oc-accent: ${accent}`,
    `--oc-accent-strong: ${adaptForLightLineStroke(accent)}`,
    `--oc-positive: ${theme.colors.positive}`,
    `--oc-negative: ${theme.colors.negative}`,
    `--oc-legend-text: ${theme.isDark ? '#d0d6e0' : '#3f3f46'}`,
    `--oc-space-2: ${theme.spacing.chromeGap * 2}px`,
    `--oc-space-4: ${theme.spacing.padding}px`,
  ];

  const rules = [
    `svg.oc-chart { ${props.join('; ')}; }`,
    `.oc-chrome { font-family: var(--oc-font-family); }`,
    `.oc-eyebrow { font-size: var(--oc-eyebrow-size); font-weight: var(--oc-eyebrow-weight); letter-spacing: var(--oc-eyebrow-tracking); text-transform: uppercase; fill: var(--oc-accent); }`,
    `.oc-title { font-size: var(--oc-title-size); font-weight: var(--oc-title-weight); letter-spacing: var(--oc-title-tracking); fill: var(--oc-text); }`,
    `.oc-subtitle { font-size: var(--oc-subtitle-size); font-weight: var(--oc-subtitle-weight); fill: var(--oc-text-muted); }`,
    `.oc-source, .oc-byline, .oc-footer { font-size: var(--oc-source-size); font-weight: var(--oc-source-weight); fill: var(--oc-text-muted); }`,
    `.oc-brand { font-size: 11px; font-weight: 510; letter-spacing: 0.02em; fill: var(--oc-text-faint); }`,
    `.oc-brand-dot { fill: var(--oc-accent); }`,
    `.oc-eyebrow-dot { fill: var(--oc-accent); }`,
    `.oc-metrics { font-family: var(--oc-font-family); }`,
    `.oc-metric-label { font-size: 10px; font-weight: 510; letter-spacing: 0.08em; text-transform: uppercase; fill: var(--oc-text-muted); }`,
    `.oc-metric-value { font-size: 22px; font-weight: 510; letter-spacing: -0.01em; fill: var(--oc-text); font-variant-numeric: tabular-nums; }`,
    `.oc-metric-delta-up { fill: var(--oc-positive); font-size: 12px; font-weight: 510; }`,
    `.oc-metric-delta-down { fill: var(--oc-negative); font-size: 12px; font-weight: 510; }`,
    `.oc-axis-tick-inline { font-size: 11px; font-weight: 400; fill: var(--oc-text-muted); }`,
    `.oc-endpoint-labels { font-family: var(--oc-font-family); }`,
    `.oc-endpoint-label { fill: var(--oc-endpoint-label-color, var(--oc-text)); }`,
    `.oc-endpoint-value { fill: var(--oc-endpoint-value-color, var(--oc-text-muted)); }`,
    `.oc-annotation-subtitle { fill: var(--oc-annotation-subtitle-color, var(--oc-text-muted)); }`,
    `.oc-legend { font-family: var(--oc-font-family); font-size: var(--oc-body-size); }`,
    `.oc-legend text { fill: var(--oc-legend-text); }`,
  ];

  return rules.join('\n');
}

function stripInteractiveElements(svg: Element): void {
  const selectors = ['[data-voronoi-overlay]', '[data-crosshair]', '[data-snap-dots]'];
  for (const selector of selectors) {
    const els = svg.querySelectorAll(selector);
    for (const el of els) {
      el.parentNode?.removeChild(el);
    }
  }
}

/**
 * Render a chart spec to a standalone SVG string without a browser DOM.
 *
 * Requires `happy-dom` as a peer dependency (`bun add happy-dom`).
 *
 * Not safe for concurrent invocation: the render pipeline relies on a global
 * SVG ID counter and a temporary global `document` swap, both of which are
 * single-threaded. In a server handling parallel requests, serialize calls
 * through a queue or mutex.
 *
 * The entire render pipeline is synchronous; the global swap is safe as long
 * as no code schedules microtasks that outlive the call.
 */
export function renderStaticSVG(
  spec: ChartSpec | LayerSpec,
  options?: StaticRenderOptions,
): string {
  let Window: typeof import('happy-dom').Window;
  try {
    ({ Window } = esmRequire('happy-dom') as typeof import('happy-dom'));
  } catch {
    throw new Error(
      "renderStaticSVG requires 'happy-dom' as a peer dependency. Install it with: npm add happy-dom",
    );
  }
  const win = new Window({ url: 'about:blank' });

  const prevDocument = globalThis.document;
  const prevWindow = (globalThis as Record<string, unknown>).window;

  try {
    (globalThis as Record<string, unknown>).document = win.document;
    (globalThis as Record<string, unknown>).window = win;

    resetSvgIdCounter();

    const width = options?.width ?? 640;
    const height = options?.height ?? 420;
    const darkMode = resolveStaticDarkMode(options?.darkMode);

    const compileOpts: CompileOptions = {
      width,
      height,
      theme: options?.theme,
      darkMode,
      watermark: options?.watermark,
    };

    let layout: ChartLayout;
    if (isLayerSpec(spec)) {
      layout = compileLayer(spec, compileOpts);
    } else {
      layout = compileChart(spec, compileOpts);
    }

    const container = win.document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    // renderChartSVG appends to container; the container and SVG are owned by
    // the happy-dom Window which is closed in the finally block.
    const svg = renderChartSVG(layout, container as unknown as HTMLElement, {
      animate: false,
      crosshair: false,
    });

    stripInteractiveElements(svg);

    // Inject a <style> block with resolved theme values so CSS-dependent
    // properties (accent dots, letter-spacing, tabular-nums) render correctly
    // without an external stylesheet. Uses `svg.oc-chart` instead of `:root`
    // to keep custom properties scoped to this SVG when embedded in HTML.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const doc = win.document as unknown as Document;
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = doc.createElementNS(SVG_NS, 'defs');
      svg.insertBefore(defs as unknown as Node, svg.firstChild);
    }
    const styleEl = doc.createElementNS(SVG_NS, 'style');
    styleEl.textContent = buildThemeStyleBlock(layout.theme);
    defs.insertBefore(styleEl as unknown as Node, defs.firstChild);

    const serializer = new (
      win as unknown as { XMLSerializer: typeof XMLSerializer }
    ).XMLSerializer();
    return serializer.serializeToString(svg as unknown as Node);
  } finally {
    if (prevDocument !== undefined) {
      (globalThis as Record<string, unknown>).document = prevDocument;
    } else {
      delete (globalThis as Record<string, unknown>).document;
    }
    if (prevWindow !== undefined) {
      (globalThis as Record<string, unknown>).window = prevWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    win.close();
  }
}
