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
import { computeTilePositions, STATE_CODE_SET, STATE_NAMES } from './layout';
import type { NormalizedTileMapSpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_CORNER_RADIUS = 2;
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

  // 6. Extract values from data
  const stateValueMap = new Map<string, number>();

  for (const row of tilemapSpec.data) {
    const stateCode = String(row[stateField]);
    const value = Number(row[valueField]) || 0;

    if (STATE_CODE_SET.has(stateCode)) {
      stateValueMap.set(stateCode, value);
    }
  }

  // 7. Compute value range for color scale
  const values = Array.from(stateValueMap.values());
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 100;

  // 8. Build color scale
  const paletteStops = [...SEQUENTIAL_PALETTES[tilemapSpec.palette]];
  if (isDarkMode) paletteStops.reverse();

  const domain = paletteStops.map((_, i) => min + (i / (paletteStops.length - 1)) * (max - min));
  const colorScale = scaleLinear<string>().domain(domain).range(paletteStops).clamp(true);

  // 9. Reserve space for gradient legend at bottom
  const legendBarHeight = 12;
  const legendLabelGap = 4;
  const legendTotalHeight = legendBarHeight + legendLabelGap + 14; // 14 for label font size

  // 10. Compute tile positions in the remaining area
  const tileAreaHeight = fullArea.height - legendTotalHeight - 8; // 8px gap above legend
  const tilePositions = computeTilePositions(fullArea.width, tileAreaHeight, 4);

  // Center tile grid horizontally
  const tileGridOffsetX = fullArea.x + (fullArea.width - tilePositions.gridWidth) / 2;
  const tileGridOffsetY = fullArea.y;

  // Position for legend
  const legendX = tileGridOffsetX;
  const legendY = tileGridOffsetY + tilePositions.gridHeight + 8;
  const legendWidth = tilePositions.gridWidth;

  // 11. Build TileMapTileMark[]
  const formatter = buildD3Formatter(tilemapSpec.valueFormat) || formatNumber;
  const neutralFillLight = '#e0e0e0';
  const neutralFillDark = '#2a2a3e';
  const neutralStrokeLight = '#d0d0d0';
  const neutralStrokeDark = '#3a3a50';

  const neutralFill = isDarkMode ? neutralFillDark : neutralFillLight;
  const neutralStroke = isDarkMode ? neutralStrokeDark : neutralStrokeLight;

  const tiles: TileMapTileMark[] = [];

  for (const [stateCode] of stateValueMap) {
    const pos = tilePositions.positions.get(stateCode);
    if (!pos) continue;

    const value = stateValueMap.get(stateCode);
    const hasData = value !== undefined && value !== null;
    const fill = hasData ? colorScale(value) : neutralFill;
    const formattedValue = hasData ? formatter(value) : '–';

    const labelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: tilePositions.tileSize > 24 ? 14 : 11,
      fontWeight: 700,
      fill: '#ffffff',
      lineHeight: 1.2,
    };

    const valueLabelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: tilePositions.tileSize > 24 ? 12 : 10,
      fontWeight: 400,
      fill: '#ffffff',
      lineHeight: 1.2,
    };

    // Only show value label on larger tiles
    const valueLabel =
      tilePositions.tileSize < 24
        ? { text: '', x: 0, y: 0, style: valueLabelStyle, visible: false }
        : {
            text: formattedValue,
            x: tileGridOffsetX + pos.x + tilePositions.tileSize / 2,
            y: tileGridOffsetY + pos.y + tilePositions.tileSize / 2 + 8,
            style: valueLabelStyle,
            visible: true,
          };

    const tile: TileMapTileMark = {
      type: 'tile' as const,
      stateCode,
      x: tileGridOffsetX + pos.x,
      y: tileGridOffsetY + pos.y,
      size: tilePositions.tileSize,
      fill,
      stroke: neutralStroke,
      strokeWidth: TILE_STROKE_WIDTH,
      cornerRadius: TILE_CORNER_RADIUS,
      value: value ?? null,
      formattedValue,
      hasData,
      label: {
        text: stateCode,
        x: tileGridOffsetX + pos.x + tilePositions.tileSize / 2,
        y: tileGridOffsetY + pos.y + tilePositions.tileSize / 2 - 4,
        style: labelStyle,
        visible: true,
      },
      valueLabel,
      data: { state: stateCode, value, stateName: STATE_NAMES[stateCode] ?? stateCode },
      aria: {
        role: 'img',
        label: `${STATE_NAMES[stateCode] ?? stateCode}: ${formattedValue}`,
      },
      animationIndex: tiles.length,
    };

    tiles.push(tile);
  }

  // 12. Build gradient legend
  const gradientColorStops: GradientColorStop[] = paletteStops.map((color, i) => ({
    offset: i / (paletteStops.length - 1),
    color,
  }));

  const gradientLegend: GradientLegendLayout = {
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
