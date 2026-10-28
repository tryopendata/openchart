import type {
  BarListSpec,
  ChartSpec,
  CompileOptions,
  DarkMode,
  GeoMapSpec,
  LayerSpec,
  ResolvedTheme,
  ThemeConfig,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import {
  isBarListSpec,
  isGeoMapSpec,
  isLayerSpec,
  isTileMapSpec,
} from '@opendata-ai/openchart-core';
import {
  compileBarList,
  compileChart,
  compileGeoMap,
  compileLayer,
  compileTileMap,
} from '@opendata-ai/openchart-engine';
import { renderBarListSVG } from './barlist-renderer';
import { applyMapCamera, cameraForTarget } from './map-camera';
import { renderMapSVG } from './map-renderer';
import { createIdScope, createRenderContext } from './render-context';
import { applyRoleStyle, type ElementFactory } from './renderers/svg-dom';
import { type StaticElement, serialize, staticFactory } from './static-dom';
import { renderChartSVG } from './svg-renderer';
import { buildThemeStyleBlock } from './theme-style-block';
import { renderTileMapSVG } from './tilemap-renderer';
export interface StaticRenderOptions {
  /** Stable XML-safe prefix, unique for figures sharing one document. */
  idPrefix?: string;
  width?: number;
  height?: number;
  theme?: ThemeConfig;
  /** `auto` resolves to light without a browser. */
  darkMode?: DarkMode;
  renderer?: 'auto' | 'svg' | 'canvas';
  watermark?: boolean;
  measureText?: CompileOptions['measureText'];
  /** Geometry decimal places; null preserves raw doubles. Default 3. */
  precision?: number | null;
}
type StaticSpec = ChartSpec | LayerSpec | TileMapSpec | GeoMapSpec | BarListSpec;
/** Render standalone SVG using a per-call element tree and id scope. */
export function renderStaticSVG(spec: StaticSpec, options?: StaticRenderOptions): string {
  return __renderStaticParts(spec, options).serialize();
}
/** @internal Split rendering from serialization for parity and interleaving tests. */
export function __renderStaticParts(
  spec: StaticSpec,
  options: StaticRenderOptions = {},
  factory: ElementFactory = staticFactory,
) {
  if (options.idPrefix !== undefined && !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(options.idPrefix))
    throw new Error(
      'idPrefix must start with a letter or underscore and contain only letters, digits, underscores, periods or hyphens.',
    );
  const precision = options.precision === undefined ? 3 : options.precision;
  if (precision !== null && (!Number.isInteger(precision) || precision < 0 || precision > 15))
    throw new Error('precision must be an integer between 0 and 15, or null.');
  const type = (spec as { type?: string }).type;
  if (type && !['chart', 'layer', 'barlist', 'tilemap', 'map', 'geomap'].includes(type))
    throw new Error(
      `renderStaticSVG does not render "${type}"; supported: chart, layer, barlist, tilemap, geomap`,
    );
  const ctx = createRenderContext({
    factory,
    ids: createIdScope(options.idPrefix),
    interactive: false,
    precision,
  });
  const compileOpts: CompileOptions = {
    width: options.width ?? 640,
    height: options.height ?? 420,
    theme: options.theme,
    darkMode: options.darkMode === 'force',
    renderer: options.renderer,
    watermark: options.watermark,
    measureText: options.measureText,
    onWarn: () => {},
  };
  let svg: SVGElement;
  let theme: ResolvedTheme;
  const map = isGeoMapSpec(spec),
    tilemap = isTileMapSpec(spec);
  if (map) {
    const layout = compileGeoMap(spec, compileOpts);
    svg = renderMapSVG(layout, { animate: false, context: ctx });
    if (!layout.views) applyMapCamera(svg, cameraForTarget(layout, layout.focus?.target), layout);
    theme = layout.theme;
  } else if (tilemap) {
    const layout = compileTileMap(spec, compileOpts);
    svg = renderTileMapSVG(layout, { animate: false, context: ctx });
    theme = layout.theme;
  } else if (isBarListSpec(spec)) {
    const layout = compileBarList(
      { ...spec, height: options.height ?? spec.height ?? 'auto' },
      compileOpts,
    );
    svg = renderBarListSVG(layout, { animate: false, context: ctx });
    theme = layout.theme;
  } else {
    const layout = isLayerSpec(spec)
      ? compileLayer(spec, compileOpts)
      : compileChart(spec, compileOpts);
    svg = renderChartSVG(layout, factory.html('div'), {
      animate: false,
      crosshair: false,
      context: ctx,
    });
    theme = layout.theme;
  }
  svg.setAttribute('data-theme', theme.isDark ? 'dark' : 'light');
  if (options.idPrefix) svg.setAttribute('id', `${options.idPrefix}-oc-root`);
  if (map || tilemap) {
    let defs: SVGElement | null = svg.querySelector('defs');
    if (!defs) {
      defs = factory.svg('defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    const style = factory.svg('style');
    style.textContent = buildThemeStyleBlock(
      theme,
      options.idPrefix ? `${options.idPrefix}-oc-root` : undefined,
    );
    defs.insertBefore(style, defs.firstChild);
  } else inlineStaticStyles(svg, theme);
  return { svg, serialize: () => serialize(svg as unknown as StaticElement, { precision }) };
}
function inlineStaticStyles(svg: SVGElement, theme: ResolvedTheme): void {
  const roleContext = { theme };
  svg.setAttribute('font-family', theme.fonts.family);
  svg.style.setProperty('font-variant-numeric', 'tabular-nums');
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const role of (el.getAttribute('class') ?? '').split(/\s+/))
      applyRoleStyle(roleContext, el as SVGElement, role);
    if (el.tagName.toLowerCase() === 'text' && el.closest('.oc-legend'))
      applyRoleStyle(roleContext, el as SVGElement, 'oc-legend-text');
  }
}
