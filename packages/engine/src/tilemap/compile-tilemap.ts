/**
 * TileMap compilation pipeline.
 *
 * Takes a raw tilemap spec (unknown shape), validates, normalizes, resolves
 * theme, computes chrome, builds a color scale, computes tile positions and
 * marks, builds legend and tooltips, and returns a TileMapLayout.
 *
 * Supports two color modes:
 * - Quantitative (default): opacity-based encoding with a single base color
 * - Categorical: distinct fill colors per category (via `colors` map or
 *   `encoding.color` channel)
 *
 * Pipeline:
 *   validate -> normalize -> resolve theme -> dark mode adapt ->
 *   compute chrome -> extract data -> build color scale -> compute positions ->
 *   build tile marks -> legend -> tooltips -> a11y -> animation ->
 *   return TileMapLayout
 */

import type {
  CategoricalLegendLayout,
  CompileOptions,
  GradientColorStop,
  GradientLegendLayout,
  LegendEntry,
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
  CATEGORICAL_PALETTE,
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
const LEGEND_SWATCH_SIZE = 10;
const LEGEND_SWATCH_GAP = 6;
const LEGEND_ENTRY_GAP = 16;

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

  // 5. Detect categorical vs quantitative mode
  const isCategorical =
    tilemapSpec.encoding.color !== undefined || tilemapSpec.colors !== undefined;

  if (isCategorical) {
    return compileCategorical(tilemapSpec, options, theme, chrome, fullArea, isDarkMode, watermark);
  }
  return compileQuantitative(tilemapSpec, options, theme, chrome, fullArea, isDarkMode, watermark);
}

// ---------------------------------------------------------------------------
// Quantitative mode (opacity-based sequential coloring)
// ---------------------------------------------------------------------------

function compileQuantitative(
  tilemapSpec: NormalizedTileMapSpec,
  options: CompileOptions,
  theme: ResolvedTheme,
  chrome: ReturnType<typeof computeChrome>,
  fullArea: { x: number; y: number; width: number; height: number },
  isDarkMode: boolean | undefined,
  watermark: boolean,
): TileMapLayout {
  const stateField = tilemapSpec.encoding.state.field;
  const valueField = tilemapSpec.encoding.value.field;

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

  const values = Array.from(stateValueMap.values());
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 100;

  const paletteStops = [...(SEQUENTIAL_PALETTES[tilemapSpec.palette] ?? SEQUENTIAL_PALETTES.blue)];
  const baseColor = isDarkMode ? paletteStops[0] : paletteStops[paletteStops.length - 1];
  const opacityRange: [number, number] = isDarkMode ? [0.15, 1] : [0.2, 1];
  const opacityScale = scaleLinear<number>().domain([min, max]).range(opacityRange).clamp(true);

  const showLegend = tilemapSpec.legend?.show !== false;
  const legendBarHeight = 6;
  const legendLabelGap = 6;
  const legendTotalHeight = showLegend ? legendBarHeight + legendLabelGap + 14 : 0;

  const legendGap = showLegend ? 8 : 0;
  const tileAreaHeight = fullArea.height - legendTotalHeight - legendGap;
  const tilePositions = computeTilePositions(fullArea.width, tileAreaHeight, 5);

  const tileGridOffsetX = fullArea.x + (fullArea.width - tilePositions.gridWidth) / 2;
  const tileGridOffsetY = fullArea.y;
  const legendX = tileGridOffsetX;
  const legendY = tileGridOffsetY + tilePositions.gridHeight + legendGap;
  const legendWidth = tilePositions.gridWidth;

  const formatter = buildD3Formatter(tilemapSpec.valueFormat) ?? formatNumber;
  const neutralFill = isDarkMode ? '#1e2a30' : '#e0e0e0';
  const neutralStroke = isDarkMode ? 'rgba(255,255,255,0.08)' : '#d0d0d0';

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

    tiles.push(
      buildTileMark({
        stateCode,
        pos,
        tileSize: tilePositions.tileSize,
        gridOffsetX: tileGridOffsetX,
        gridOffsetY: tileGridOffsetY,
        fill,
        fillOpacity: hasData ? opacity : 1,
        stroke,
        value,
        formattedValue,
        hasData,
        theme,
      }),
    );
  }

  assignAnimationIndices(tiles);

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

  const tooltipDescriptors = buildTooltips(tiles);
  const a11y = {
    altText: `Tile map of US states showing values from ${formatter(min)} to ${formatter(max)}`,
    dataTableFallback: tiles.map((t) => [t.stateCode, t.formattedValue]),
    role: 'img',
    keyboardNavigable: tiles.length > 0,
  };

  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(tilemapSpec.animation);
  const padding = theme.spacing.padding;
  const contentHeight =
    tileGridOffsetY +
    tilePositions.gridHeight +
    legendGap +
    legendTotalHeight +
    chrome.bottomHeight +
    padding;

  return {
    area: fullArea,
    chrome,
    tiles,
    gradientLegend,
    categoricalLegend: null,
    tooltipDescriptors,
    a11y,
    theme,
    width: options.width,
    height: contentHeight,
    animation: resolvedAnimation,
    watermark,
    measureText:
      options.measureText ??
      ((text, fontSize) => ({ width: estimateTextWidth(text, fontSize), height: fontSize })),
  };
}

// ---------------------------------------------------------------------------
// Categorical mode (distinct fill colors per category)
// ---------------------------------------------------------------------------

function compileCategorical(
  tilemapSpec: NormalizedTileMapSpec,
  options: CompileOptions,
  theme: ResolvedTheme,
  chrome: ReturnType<typeof computeChrome>,
  fullArea: { x: number; y: number; width: number; height: number },
  isDarkMode: boolean | undefined,
  watermark: boolean,
): TileMapLayout {
  const stateField = tilemapSpec.encoding.state.field;
  const colorField = tilemapSpec.encoding.color?.field ?? tilemapSpec.encoding.value.field;

  // Extract category per state
  const stateCategoryMap = new Map<string, string>();
  for (const row of tilemapSpec.data) {
    const stateCode = String(row[stateField]);
    const raw = row[colorField];
    if (STATE_CODE_SET.has(stateCode) && raw !== null && raw !== undefined) {
      stateCategoryMap.set(stateCode, String(raw));
    }
  }

  // Collect unique categories in data order
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const row of tilemapSpec.data) {
    const raw = row[colorField];
    if (raw !== null && raw !== undefined) {
      const cat = String(raw);
      if (!seen.has(cat)) {
        seen.add(cat);
        categories.push(cat);
      }
    }
  }

  // Build category -> color mapping
  const categoryColors = new Map<string, string>();
  if (tilemapSpec.colors) {
    for (const cat of categories) {
      categoryColors.set(
        cat,
        tilemapSpec.colors[cat] ??
          CATEGORICAL_PALETTE[categoryColors.size % CATEGORICAL_PALETTE.length],
      );
    }
  } else {
    for (let i = 0; i < categories.length; i++) {
      categoryColors.set(categories[i], CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]);
    }
  }

  const showLegend = tilemapSpec.legend?.show !== false;
  const legendRowHeight = LEGEND_SWATCH_SIZE + 6;
  const legendTotalHeight = showLegend ? legendRowHeight : 0;

  const legendGap = showLegend ? 8 : 0;
  const tileAreaHeight = fullArea.height - legendTotalHeight - legendGap;
  const tilePositions = computeTilePositions(fullArea.width, tileAreaHeight, 5);

  const tileGridOffsetX = fullArea.x + (fullArea.width - tilePositions.gridWidth) / 2;
  const tileGridOffsetY = fullArea.y;
  const legendX = tileGridOffsetX;
  const legendY = tileGridOffsetY + tilePositions.gridHeight + legendGap;
  const legendWidth = tilePositions.gridWidth;

  const neutralFill = isDarkMode ? '#1e2a30' : '#e0e0e0';
  const neutralStroke = isDarkMode ? 'rgba(255,255,255,0.08)' : '#d0d0d0';

  const tiles: TileMapTileMark[] = [];
  for (const { state: stateCode } of US_STATE_TILES) {
    const pos = tilePositions.positions.get(stateCode);
    if (!pos) continue;

    const hasData = stateCategoryMap.has(stateCode);
    const category = hasData ? stateCategoryMap.get(stateCode)! : null;
    const fill = hasData ? (categoryColors.get(category!) ?? neutralFill) : neutralFill;
    const stroke = hasData
      ? isDarkMode
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(0,0,0,0.1)'
      : neutralStroke;
    const formattedValue = category ? formatCategoryLabel(category) : '–';

    tiles.push(
      buildTileMark({
        stateCode,
        pos,
        tileSize: tilePositions.tileSize,
        gridOffsetX: tileGridOffsetX,
        gridOffsetY: tileGridOffsetY,
        fill,
        fillOpacity: 1,
        stroke,
        value: null,
        formattedValue,
        hasData,
        theme,
        category: hasData ? category : undefined,
      }),
    );
  }

  assignAnimationIndices(tiles);

  let categoricalLegend: CategoricalLegendLayout | null = null;
  if (showLegend) {
    const labelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: 11,
      fontWeight: 400,
      fill: theme.colors.text,
      lineHeight: 1.2,
    };

    const entries: LegendEntry[] = categories.map((cat) => ({
      label: formatCategoryLabel(cat),
      color: categoryColors.get(cat)!,
      shape: 'square' as const,
    }));

    categoricalLegend = {
      type: 'categorical',
      position: 'bottom',
      bounds: { x: legendX, y: legendY, width: legendWidth, height: legendRowHeight },
      labelStyle,
      entries,
      swatchSize: LEGEND_SWATCH_SIZE,
      swatchGap: LEGEND_SWATCH_GAP,
      entryGap: LEGEND_ENTRY_GAP,
      swatchChipFill: 'transparent',
    };
  }

  const tooltipDescriptors = buildTooltips(tiles, 'Category');
  const categoryList = categories.map(formatCategoryLabel).join(', ');
  const a11y = {
    altText: `Tile map of US states showing categories: ${categoryList}`,
    dataTableFallback: tiles.map((t) => [t.stateCode, t.formattedValue]),
    role: 'img',
    keyboardNavigable: tiles.length > 0,
  };

  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(tilemapSpec.animation);
  const padding = theme.spacing.padding;
  const contentHeight =
    tileGridOffsetY +
    tilePositions.gridHeight +
    legendGap +
    legendTotalHeight +
    chrome.bottomHeight +
    padding;

  return {
    area: fullArea,
    chrome,
    tiles,
    gradientLegend: null,
    categoricalLegend,
    tooltipDescriptors,
    a11y,
    theme,
    width: options.width,
    height: contentHeight,
    animation: resolvedAnimation,
    watermark,
    measureText:
      options.measureText ??
      ((text, fontSize) => ({ width: estimateTextWidth(text, fontSize), height: fontSize })),
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface TileMarkOptions {
  stateCode: string;
  pos: { x: number; y: number };
  tileSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  fill: string;
  fillOpacity: number;
  stroke: string;
  value: number | null;
  formattedValue: string;
  hasData: boolean;
  theme: ResolvedTheme;
  category?: string | null;
}

function buildTileMark(opts: TileMarkOptions): TileMapTileMark {
  const {
    stateCode,
    pos,
    tileSize,
    gridOffsetX,
    gridOffsetY,
    fill,
    fillOpacity,
    stroke,
    value,
    formattedValue,
    hasData,
    theme,
    category,
  } = opts;
  const tileCenterX = gridOffsetX + pos.x + tileSize / 2;
  const tileTopY = gridOffsetY + pos.y;

  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: tileSize > 24 ? 10 : 7,
    fontWeight: 700,
    fill: '#ffffff',
    lineHeight: 1.2,
  };

  const valueLabelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: tileSize > 24 ? 10 : 7,
    fontWeight: 300,
    fill: 'rgba(255,255,255,0.6)',
    lineHeight: 1.2,
  };

  const valueLabel =
    tileSize < 24
      ? { text: '', x: 0, y: 0, style: valueLabelStyle, visible: false }
      : {
          text: formattedValue,
          x: tileCenterX,
          y: tileTopY + tileSize * 0.78,
          style: valueLabelStyle,
          visible: true,
        };

  const data: Record<string, unknown> = {
    state: stateCode,
    value,
    stateName: STATE_NAMES[stateCode] ?? stateCode,
  };
  if (category !== undefined) {
    data.category = category;
  }

  return {
    type: 'tile' as const,
    stateCode,
    x: gridOffsetX + pos.x,
    y: tileTopY,
    size: tileSize,
    fill,
    fillOpacity,
    stroke,
    strokeWidth: TILE_STROKE_WIDTH,
    cornerRadius: TILE_CORNER_RADIUS,
    value,
    formattedValue,
    hasData,
    label: {
      text: stateCode,
      x: tileCenterX,
      y: tileTopY + tileSize * 0.28,
      style: labelStyle,
      visible: true,
    },
    valueLabel,
    data,
    aria: {
      role: 'img',
      label: `${STATE_NAMES[stateCode] ?? stateCode}: ${formattedValue}`,
    },
    animationIndex: 0,
  };
}

function assignAnimationIndices(tiles: TileMapTileMark[]): void {
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
}

function buildTooltips(
  tiles: TileMapTileMark[],
  fieldLabel = 'Value',
): Map<string, TooltipContent> {
  const tooltipDescriptors = new Map<string, TooltipContent>();
  for (const tile of tiles) {
    const fields: TooltipField[] = [{ label: fieldLabel, value: tile.formattedValue }];
    tooltipDescriptors.set(tile.stateCode, {
      title: STATE_NAMES[tile.stateCode] ?? tile.stateCode,
      fields,
    });
  }
  return tooltipDescriptors;
}

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    categoricalLegend: null,
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
