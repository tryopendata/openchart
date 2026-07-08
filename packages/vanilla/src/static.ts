import { createRequire } from 'node:module';
import type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  DarkMode,
  GraphSpec,
  LayerSpec,
  ResolvedTheme,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { isLayerSpec } from '@opendata-ai/openchart-core';
import { compileChart, compileLayer } from '@opendata-ai/openchart-engine';
import { resetSvgIdCounter } from './svg-ids';
import { renderChartSVG } from './svg-renderer';

export interface StaticRenderOptions {
  width?: number;
  height?: number;
  theme?: ThemeConfig;
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

  return [
    `.oc-brand-dot { fill: ${accent}; }`,
    `.oc-eyebrow-dot { fill: ${accent}; }`,
    `.oc-eyebrow { letter-spacing: 0.08em; text-transform: uppercase; }`,
    `.oc-brand { letter-spacing: 0.02em; }`,
    `.oc-metric-value { font-variant-numeric: tabular-nums; }`,
    `.oc-annotation-subtitle { fill: ${theme.colors.axis}; }`,
    `.oc-endpoint-label { fill: ${theme.colors.text}; }`,
    `.oc-endpoint-value { fill: ${theme.colors.axis}; }`,
    `:root { --oc-bg: ${bg}; --oc-text: ${theme.colors.text}; --oc-text-muted: ${theme.colors.axis}; --oc-accent: ${accent}; }`,
  ].join('\n');
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

export function renderStaticSVG(
  spec: ChartSpec | LayerSpec | GraphSpec,
  options?: StaticRenderOptions,
): string {
  const esmRequire = createRequire(import.meta.url);
  const { Window } = esmRequire('happy-dom') as typeof import('happy-dom');
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
      layout = compileLayer(spec as LayerSpec, compileOpts);
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

    const svg = renderChartSVG(layout, container as unknown as HTMLElement, {
      animate: false,
      crosshair: false,
    });

    stripInteractiveElements(svg);

    // Inject a <style> block with resolved theme values so CSS-dependent
    // properties (accent dots, letter-spacing, tabular-nums) render correctly
    // without an external stylesheet.
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
