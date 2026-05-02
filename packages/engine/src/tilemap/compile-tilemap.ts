/**
 * TileMap compilation pipeline.
 *
 * Takes a raw tilemap spec (unknown shape), validates, normalizes, resolves
 * theme, computes chrome, builds a color scale, computes tile positions and
 * marks, builds legend and tooltips, and returns a TileMapLayout.
 *
 * Pipeline:
 *   validate -> normalize -> resolve theme -> dark mode adapt ->
 *   compute chrome -> extract data -> build color scale -> compute positions ->
 *   build tile marks -> legend -> tooltips -> a11y -> animation ->
 *   return TileMapLayout
 */

import type {
  CompileOptions,
  GradientColorStop,
  GradientLegendLayout,
  ResolvedAnimation,
  ResolvedTheme,
  TextStyle,
  TileMapLayout,
  TileMapTileMark,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  buildD3Formatter,
  computeChrome,
  estimateTextWidth,
  formatNumber,
  resolveTheme,
  SEQUENTIAL_PALETTES,
} from '@opendata-ai/openchart-core';
import { scaleLinear } from 'd3-scale';

import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { computeTilePositions, STATE_CODE_SET, STATE_NAMES, US_STATE_TILES } from './layout';
import type { NormalizedTileMapSpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_CORNER_RADIUS = 6;
const TILE_STROKE_WIDTH = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a tilemap spec into a TileMapLayout.
 *
 * @param spec - Raw tilemap spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns TileMapLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a tilemap type.
 */
export function compileTileMap(spec: unknown, options: CompileOptions): TileMapLayout {
  // 1. Validate + normalize via the shared compiler pipeline
  const { spec: normalized } = compileSpec(spec);

  if (!('type' in normalized) || normalized.type !== 'tilemap') {
    throw new Error(
      'compileTileMap received a non-tilemap spec. Use compileChart, compileTable, compileGraph, or compileSankey instead.',
    );
  }

  const tilemapSpec = normalized as NormalizedTileMapSpec;

  // Resolve watermark: explicit spec value wins, then options fallback, then default true.
  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark =
    rawWatermark !== undefined ? tilemapSpec.watermark : (options.watermark ?? true);

  // 2. Resolve theme
  const mergedThemeConfig = options.theme
    ? { ...tilemapSpec.theme, ...options.theme }
    : tilemapSpec.theme;
  const lightTheme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  let theme: ResolvedTheme = lightTheme;
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  const isDarkMode = options.darkMode;

  // 3. Compute chrome
  const chrome = computeChrome(
    {
      title: tilemapSpec.chrome.title,
      subtitle: tilemapSpec.chrome.subtitle,
      source: tilemapSpec.chrome.source,
      byline: tilemapSpec.chrome.byline,
      footer: tilemapSpec.chrome.footer,
    },
    theme,
    options.width,
    options.measureText,
    'full',
    undefined,
    watermark,
  );

  // 4. Compute drawing area (total space minus chrome)
  const padding = theme.spacing.padding;
  const fullArea = {
    x: padding,
    y: padding + chrome.topHeight,
    width: options.width - padding * 2,
    height: options.height - chrome.topHeight - chrome.bottomHeight - padding * 2,
  };

  // Guard against negative dimensions
  if (fullArea.width <= 0 || fullArea.height <= 0) {
    return emptyLayout(chrome, theme, options, watermark);
  }

  // 5. Extract encoding fields
  const stateField = tilemapSpec.encoding.state.field;
  const valueField = tilemapSpec.encoding.value.field;

  // 6. Extract values from data, preserving null/undefined as missing
  const stateValueMap = new Map<string, number>();

  for (const row of tilemapSpec.data) {
    const stateCode = String(row[stateField]);
    const raw = row[valueField];

    if (STATE_CODE_SET.has(stateCode) && raw !== null && raw !== undefined) {
      const value = Number(raw);
      if (!Number.isNaN(value)) {
        stateValueMap.set(stateCode, value);
      }
    }
  }

  // 7. Compute value range for color scale
  const values = Array.from(stateValueMap.values());
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 100;

  // 8. Build opacity scale: single base color, opacity encodes value
  const paletteStops = [...(SEQUENTIAL_PALETTES[tilemapSpec.palette] ?? SEQUENTIAL_PALETTES.blue)];
  const baseColor = isDarkMode ? paletteStops[0] : paletteStops[paletteStops.length - 1];
  const opacityRange: [number, number] = isDarkMode ? [0.15, 1] : [0.2, 1];
  const opacityScale = scaleLinear<number>().domain([min, max]).range(opacityRange).clamp(true);

  // 9. Reserve space for gradient legend at bottom (unless hidden)
  const showLegend = tilemapSpec.legend?.show !== false;
  const legendBarHeight = 6;
  const legendLabelGap = 6;
  const legendTotalHeight = showLegend ? legendBarHeight + legendLabelGap + 14 : 0;

  // 10. Compute tile positions in the remaining area
  const legendGap = showLegend ? 8 : 0;
  const tileAreaHeight = fullArea.height - legendTotalHeight - legendGap;
  const tilePositions = computeTilePositions(fullArea.width, tileAreaHeight, 5);

  // Center tile grid horizontally
  const tileGridOffsetX = fullArea.x + (fullArea.width - tilePositions.gridWidth) / 2;
  const tileGridOffsetY = fullArea.y;

  // Position for legend
  const legendX = tileGridOffsetX;
  const legendY = tileGridOffsetY + tilePositions.gridHeight + legendGap;
  const legendWidth = tilePositions.gridWidth;

  // 11. Build TileMapTileMark[]
  const formatter = buildD3Formatter(tilemapSpec.valueFormat) ?? formatNumber;
  const neutralFillLight = '#e0e0e0';
  const neutralFillDark = '#1e2a30';
  const neutralStrokeLight = '#d0d0d0';
  const neutralStrokeDark = 'rgba(255,255,255,0.08)';

  const neutralFill = isDarkMode ? neutralFillDark : neutralFillLight;
  const neutralStroke = isDarkMode ? neutralStrokeDark : neutralStrokeLight;

  const tiles: TileMapTileMark[] = [];

  for (const { state: stateCode } of US_STATE_TILES) {
    const pos = tilePositions.positions.get(stateCode);
    if (!pos) continue;

    const hasData = stateValueMap.has(stateCode);
    const value = hasData ? stateValueMap.get(stateCode)! : null;
    const opacity = hasData ? opacityScale(value!) : 0;
    const fill = hasData ? baseColor : neutralFill;
    const stroke = hasData
      ? isDarkMode
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(0,0,0,0.1)'
      : neutralStroke;
    const formattedValue = hasData ? formatter(value!) : '–';

    const labelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: tilePositions.tileSize > 24 ? 10 : 7,
      fontWeight: 700,
      fill: '#ffffff',
      lineHeight: 1.2,
    };

    const valueLabelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: tilePositions.tileSize > 24 ? 10 : 7,
      fontWeight: 300,
      fill: 'rgba(255,255,255,0.6)',
      lineHeight: 1.2,
    };

    const tileCenterX = tileGridOffsetX + pos.x + tilePositions.tileSize / 2;
    const tileTopY = tileGridOffsetY + pos.y;
    const sz = tilePositions.tileSize;

    // Only show value label on larger tiles
    const valueLabel =
      sz < 24
        ? { text: '', x: 0, y: 0, style: valueLabelStyle, visible: false }
        : {
            text: formattedValue,
            x: tileCenterX,
            y: tileTopY + sz * 0.78,
            style: valueLabelStyle,
            visible: true,
          };

    const tile: TileMapTileMark = {
      type: 'tile' as const,
      stateCode,
      x: tileGridOffsetX + pos.x,
      y: tileTopY,
      size: sz,
      fill,
      fillOpacity: hasData ? opacity : 1,
      stroke,
      strokeWidth: TILE_STROKE_WIDTH,
      cornerRadius: TILE_CORNER_RADIUS,
      value: value ?? null,
      formattedValue,
      hasData,
      label: {
        text: stateCode,
        x: tileCenterX,
        y: tileTopY + sz * 0.28,
        style: labelStyle,
        visible: true,
      },
      valueLabel,
      data: { state: stateCode, value, stateName: STATE_NAMES[stateCode] ?? stateCode },
      aria: {
        role: 'img',
        label: `${STATE_NAMES[stateCode] ?? stateCode}: ${formattedValue}`,
      },
      animationIndex: 0,
    };

    tiles.push(tile);
  }

  // Assign shuffled animation indices for a scattered pop-in effect.
  // Uses a deterministic Fisher-Yates shuffle so the order looks random
  // but is consistent across renders.
  const indices = Array.from({ length: tiles.length }, (_, i) => i);
  let seed = 42;
  for (let i = indices.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < tiles.length; i++) {
    tiles[i].animationIndex = indices[i];
  }

  // 12. Build gradient legend (null when legend is hidden)
  let gradientLegend: GradientLegendLayout | null = null;

  if (showLegend) {
    const numStops = 5;
    const gradientColorStops: GradientColorStop[] = Array.from({ length: numStops }, (_, i) => {
      const t = i / (numStops - 1);
      const o = opacityRange[0] + t * (opacityRange[1] - opacityRange[0]);
      return { offset: t, color: baseColor, opacity: o };
    });

    gradientLegend = {
      type: 'gradient',
      position: 'bottom',
      bounds: { x: legendX, y: legendY, width: legendWidth, height: legendBarHeight },
      labelStyle: {
        fontFamily: theme.fonts.family,
        fontSize: 11,
        fontWeight: 400,
        fill: theme.colors.text,
        lineHeight: 1.2,
      },
      colorStops: gradientColorStops,
      minLabel: formatter(min),
      maxLabel: formatter(max),
    };
  }

  // 13. Build tooltip descriptors
  const tooltipDescriptors = new Map<string, TooltipContent>();
  for (const tile of tiles) {
    const fields: TooltipField[] = [
      {
        label: 'Value',
        value: tile.formattedValue,
      },
    ];
    tooltipDescriptors.set(tile.stateCode, {
      title: STATE_NAMES[tile.stateCode] ?? tile.stateCode,
      fields,
    });
  }

  // 14. Build a11y metadata
  const a11y = {
    altText: `Tile map of US states showing values from ${formatter(min)} to ${formatter(max)}`,
    dataTableFallback: tiles.map((t) => [t.stateCode, t.formattedValue]),
    role: 'img',
    keyboardNavigable: tiles.length > 0,
  };

  // 15. Resolve animation
  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(tilemapSpec.animation);

  return {
    area: fullArea,
    chrome,
    tiles,
    gradientLegend,
    tooltipDescriptors,
    a11y,
    theme,
    width: options.width,
    height: options.height,
    animation: resolvedAnimation,
    watermark,
    measureText:
      options.measureText ??
      ((text, fontSize) => ({ width: estimateTextWidth(text, fontSize), height: fontSize })),
  };
}

// ---------------------------------------------------------------------------
// Empty layout fallback
// ---------------------------------------------------------------------------

function emptyLayout(
  chrome: ReturnType<typeof computeChrome>,
  theme: ResolvedTheme,
  options: CompileOptions,
  watermark: boolean,
): TileMapLayout {
  return {
    area: { x: 0, y: 0, width: 0, height: 0 },
    chrome,
    tiles: [],
    gradientLegend: {
      type: 'gradient',
      position: 'bottom',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      labelStyle: {
        fontFamily: theme.fonts.family,
        fontSize: 11,
        fontWeight: 400,
        fill: theme.colors.text,
        lineHeight: 1.2,
      },
      colorStops: [],
      minLabel: '0',
      maxLabel: '0',
    },
    tooltipDescriptors: new Map(),
    a11y: {
      altText: 'Empty tile map',
      dataTableFallback: [],
      role: 'img',
      keyboardNavigable: false,
    },
    theme,
    width: options.width,
    height: options.height,
    watermark,
    animation: undefined,
    measureText:
      options.measureText ??
      ((text, fontSize) => ({ width: estimateTextWidth(text, fontSize), height: fontSize })),
  };
}
