// Node.js only — do not import from browser code.
import { createRequire } from 'node:module';
import type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  DarkMode,
  LayerSpec,
  ResolvedTheme,
  ThemeConfig,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import { isLayerSpec, isTileMapSpec } from '@opendata-ai/openchart-core';
import { compileChart, compileLayer, compileTileMap } from '@opendata-ai/openchart-engine';
import { SVG_NS } from './renderers/svg-dom';
import { resetSvgIdCounter } from './svg-ids';
import { renderChartSVG } from './svg-renderer';
import { buildThemeStyleBlock } from './theme-style-block';
import { renderTileMapSVG } from './tilemap-renderer';

const esmRequire = createRequire(import.meta.url);

let cachedWindow: typeof import('happy-dom').Window | undefined;
function getHappyDomWindow(): typeof import('happy-dom').Window {
  if (cachedWindow) return cachedWindow;
  try {
    ({ Window: cachedWindow } = esmRequire('happy-dom') as typeof import('happy-dom'));
  } catch {
    throw new Error(
      "renderStaticSVG requires 'happy-dom' as a peer dependency. Install it with: npm add happy-dom",
    );
  }
  return cachedWindow;
}

let rendering = false;

export interface StaticRenderOptions {
  width?: number;
  height?: number;
  theme?: ThemeConfig;
  /**
   * Dark mode setting. In static rendering `'auto'` resolves to light mode
   * since there is no `matchMedia` to query. Use `'force'` for dark output.
   */
  darkMode?: DarkMode;
  /** Rendering backend for point marks; see `MountOptions.renderer`. */
  renderer?: 'auto' | 'svg' | 'canvas';
  watermark?: boolean;
}

function resolveStaticDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  return false;
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
  spec: ChartSpec | LayerSpec | TileMapSpec,
  options?: StaticRenderOptions,
): string {
  if (rendering) {
    throw new Error('renderStaticSVG is not reentrant — serialize calls through a queue or mutex');
  }
  rendering = true;

  const Window = getHappyDomWindow();
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
      renderer: options?.renderer,
      watermark: options?.watermark,
    };

    let svg: SVGElement;
    let themeForStyle: ResolvedTheme;

    if (isTileMapSpec(spec)) {
      const tileMapLayout = compileTileMap(spec, compileOpts);
      svg = renderTileMapSVG(tileMapLayout, { animate: false });
      themeForStyle = tileMapLayout.theme;
    } else {
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

      svg = renderChartSVG(layout, container as unknown as HTMLElement, {
        animate: false,
        crosshair: false,
      });

      stripInteractiveElements(svg);
      themeForStyle = layout.theme;
    }

    const doc = win.document as unknown as Document;
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = doc.createElementNS(SVG_NS, 'defs');
      svg.insertBefore(defs as unknown as Node, svg.firstChild);
    }
    const styleEl = doc.createElementNS(SVG_NS, 'style');
    styleEl.textContent = buildThemeStyleBlock(themeForStyle);
    defs.insertBefore(styleEl as unknown as Node, defs.firstChild);

    const serializer = new (
      win as unknown as { XMLSerializer: typeof XMLSerializer }
    ).XMLSerializer();
    return serializer.serializeToString(svg as unknown as Node);
  } finally {
    rendering = false;
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
