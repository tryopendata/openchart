/**
 * BarList compilation pipeline.
 *
 * Takes a raw barlist spec, validates, normalizes, resolves theme, computes
 * chrome, lays out rows with proportional bars, builds tooltips and a11y,
 * and returns a BarListLayout.
 *
 * Pipeline:
 *   validate -> normalize -> resolve theme -> dark mode adapt ->
 *   compute chrome -> extract data -> sort/limit rows ->
 *   compute row layout -> build row marks -> tooltips -> a11y ->
 *   animation -> return BarListLayout
 */

import type {
  BarListLayout,
  BarListRowMark,
  CompileOptions,
  ResolvedAnimation,
  ResolvedTheme,
  TextStyle,
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
} from '@opendata-ai/openchart-core';

import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import type { NormalizedBarListSpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ROW_GAP = 8;
const LABEL_BAR_GAP = 12;
const BAR_VALUE_GAP = 12;
const VALUE_WIDTH = 56;
const LABEL_FONT_SIZE = 13;
const LABEL_FONT_WEIGHT = 500;
const SUBTITLE_FONT_SIZE = 12;
const SUBTITLE_FONT_WEIGHT = 400;
const VALUE_FONT_SIZE = 12;
const VALUE_FONT_WEIGHT = 400;

const BARLIST_COLORS = ['#06b6d4', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function compileBarList(spec: unknown, options: CompileOptions): BarListLayout {
  const { spec: normalized } = compileSpec(spec);

  if (!('type' in normalized) || normalized.type !== 'barlist') {
    throw new Error(
      'compileBarList received a non-barlist spec. Use compileChart, compileTable, compileGraph, compileSankey, or compileTileMap instead.',
    );
  }

  const barlistSpec = normalized as NormalizedBarListSpec;

  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark =
    rawWatermark !== undefined ? barlistSpec.watermark : (options.watermark ?? true);

  // Resolve theme
  const mergedThemeConfig = options.theme
    ? { ...barlistSpec.theme, ...options.theme }
    : barlistSpec.theme;
  const lightTheme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  let theme: ResolvedTheme = lightTheme;
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  // Compute chrome
  const chrome = computeChrome(
    {
      title: barlistSpec.chrome.title,
      subtitle: barlistSpec.chrome.subtitle,
      source: barlistSpec.chrome.source,
      byline: barlistSpec.chrome.byline,
      footer: barlistSpec.chrome.footer,
    },
    theme,
    options.width,
    options.measureText,
    'full',
    undefined,
    watermark,
  );

  // Compute drawing area
  const padding = theme.spacing.padding;
  const fullArea = {
    x: padding,
    y: padding + chrome.topHeight,
    width: options.width - padding * 2,
    height: options.height - chrome.topHeight - chrome.bottomHeight - padding * 2,
  };

  if (fullArea.width <= 0 || fullArea.height <= 0) {
    return emptyLayout(chrome, theme, options, watermark);
  }

  // Extract data
  const labelField = barlistSpec.encoding.label.field;
  const valueField = barlistSpec.encoding.value.field;
  const subtitleField = barlistSpec.encoding.subtitle?.field;
  const colorField = barlistSpec.encoding.color?.field;

  // Compute row dimensions up front so we can auto-cap maxItems to fit available height
  const barHeight = barlistSpec.barHeight;
  const cornerRadius =
    barlistSpec.cornerRadius === 'pill' ? barHeight / 2 : barlistSpec.cornerRadius;
  const rowContentHeight = Math.max(barHeight, LABEL_FONT_SIZE * 1.4);
  const rowHeight = rowContentHeight + DEFAULT_ROW_GAP;
  const maxFittingRows = Math.max(1, Math.floor(fullArea.height / rowHeight));

  // Filter valid rows, sort descending, cap to the lesser of maxItems and available height
  const validRows = barlistSpec.data
    .filter((row) => {
      const val = row[valueField];
      return val !== null && val !== undefined && !Number.isNaN(Number(val));
    })
    .sort((a, b) => Number(b[valueField]) - Number(a[valueField]))
    .slice(0, Math.min(barlistSpec.maxItems, maxFittingRows));

  if (validRows.length === 0) {
    return emptyLayout(chrome, theme, options, watermark);
  }

  // Use absolute max so negative-only datasets produce valid proportions (e.g. [-100,-50] -> maxAbs=100)
  const maxValue = Math.max(...validRows.map((r) => Math.abs(Number(r[valueField]))));

  // Color assignment: cycle through barlist-specific palette
  const colorMap = new Map<string, string>();
  let colorIndex = 0;
  const palette = BARLIST_COLORS;

  function getColor(row: Record<string, unknown>, idx: number): string {
    if (colorField) {
      const key = String(row[colorField] ?? '');
      if (!colorMap.has(key)) {
        colorMap.set(key, palette[colorIndex % palette.length]);
        colorIndex++;
      }
      return colorMap.get(key)!;
    }
    return palette[idx % palette.length];
  }

  // Value formatter
  const formatter = buildD3Formatter(barlistSpec.valueFormat) ?? formatNumber;

  // Compute label width: measure all labels and use a consistent width
  const measureText =
    options.measureText ??
    ((text: string, fontSize: number) => ({
      width: estimateTextWidth(text, fontSize),
      height: fontSize,
    }));

  // When subtitles are present the column must fit: labelText + 6px gap + subtitleText
  const perRowLabelWidths = new Map<number, number>();
  let maxCombinedWidth = 0;
  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const label = String(row[labelField] ?? '');
    const labelW = measureText(label, LABEL_FONT_SIZE, LABEL_FONT_WEIGHT).width;
    perRowLabelWidths.set(i, labelW);
    let combined = labelW + 4;
    if (subtitleField && row[subtitleField] != null) {
      const subtitle = String(row[subtitleField]);
      combined =
        labelW + 6 + measureText(subtitle, SUBTITLE_FONT_SIZE, SUBTITLE_FONT_WEIGHT).width + 4;
    }
    maxCombinedWidth = Math.max(maxCombinedWidth, combined);
  }
  const isNarrow = fullArea.width < 400;
  const labelBarGap = isNarrow ? 8 : LABEL_BAR_GAP;
  const barValueGap = isNarrow ? 6 : BAR_VALUE_GAP;
  const valueWidth = isNarrow ? 44 : VALUE_WIDTH;
  const maxLabelPct = isNarrow ? 0.35 : 0.4;
  const labelWidth = Math.max(50, Math.min(maxCombinedWidth, fullArea.width * maxLabelPct));

  const barAreaWidth = fullArea.width - labelWidth - labelBarGap - barValueGap - valueWidth;

  const labelColor = theme.colors.text;
  const subtitleColor = options.darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const valueColor = options.darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

  // Build row marks
  const rows: BarListRowMark[] = [];

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const value = Number(row[valueField]);
    const labelText = String(row[labelField] ?? '');
    const formattedValue = formatter(value);
    const barColor = getColor(row, i);
    const pct = maxValue > 0 ? Math.abs(value) / maxValue : 0;

    const rowY = fullArea.y + i * rowHeight;
    const centerY = rowY + rowContentHeight / 2;

    // Label (left-aligned)
    const labelX = fullArea.x;
    const labelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: LABEL_FONT_SIZE,
      fontWeight: LABEL_FONT_WEIGHT,
      fill: labelColor,
      lineHeight: 1.4,
    };

    // Subtitle (left-aligned, positioned after this row's measured label width + gap)
    let subtitle: BarListRowMark['subtitle'];
    if (subtitleField && row[subtitleField] != null) {
      const subtitleText = String(row[subtitleField]);
      const subtitleX = labelX + (perRowLabelWidths.get(i) ?? 0) + 6;
      subtitle = {
        text: subtitleText,
        x: subtitleX,
        y: centerY,
        style: {
          fontFamily: theme.fonts.family,
          fontSize: SUBTITLE_FONT_SIZE,
          fontWeight: SUBTITLE_FONT_WEIGHT,
          fill: subtitleColor,
          lineHeight: 1.4,
        },
        visible: true,
      };
    }

    // Track (muted background bar)
    const trackX = fullArea.x + labelWidth + labelBarGap;
    const trackY = centerY - barHeight / 2;
    const trackWidth = Math.max(barAreaWidth, 0);

    // Fill bar (proportional width)
    const barWidth = Math.max(pct * trackWidth, 0);

    // Value label (right-aligned)
    const valueLabelX = trackX + trackWidth + barValueGap + valueWidth;
    const valueLabelStyle: TextStyle = {
      fontFamily: `${theme.fonts.family}, ui-monospace, monospace`,
      fontSize: VALUE_FONT_SIZE,
      fontWeight: VALUE_FONT_WEIGHT,
      fill: valueColor,
      lineHeight: 1.4,
      fontVariant: 'tabular-nums',
    };

    const rowMark: BarListRowMark = {
      type: 'barlist-row',
      index: i,
      y: rowY,
      height: rowHeight,
      label: {
        text: labelText,
        x: labelX,
        y: centerY,
        style: labelStyle,
        visible: true,
      },
      subtitle,
      track: {
        x: trackX,
        y: trackY,
        width: trackWidth,
        height: barHeight,
        cornerRadius,
      },
      bar: {
        x: trackX,
        y: trackY,
        width: barWidth,
        height: barHeight,
        cornerRadius,
        fill: barColor,
      },
      valueLabel: {
        text: formattedValue,
        x: valueLabelX,
        y: centerY,
        style: valueLabelStyle,
        visible: true,
      },
      value,
      formattedValue,
      aria: {
        role: 'listitem',
        label: `${labelText}: ${formattedValue}`,
      },
      animationIndex: i,
      data: row,
    };

    rows.push(rowMark);
  }

  // Build tooltip descriptors.
  // TODO: honour encoding.tooltip channel to let callers add extra fields beyond the default value field.
  const tooltipDescriptors = new Map<string, TooltipContent>();
  for (const row of rows) {
    const fields: TooltipField[] = [
      { label: barlistSpec.encoding.value.title ?? valueField, value: row.formattedValue },
    ];
    tooltipDescriptors.set(String(row.index), {
      title: row.label.text,
      fields,
    });
  }

  // Build a11y metadata
  const a11y = {
    altText: `Bar list showing ${rows.length} items ranked by ${valueField}`,
    dataTableFallback: rows.map((r) => [r.label.text, r.formattedValue]),
    role: 'list' as const,
    keyboardNavigable: rows.length > 0,
  };

  // Resolve animation
  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(barlistSpec.animation);

  return {
    area: fullArea,
    chrome,
    rows,
    tooltipDescriptors,
    a11y,
    theme,
    width: options.width,
    height: options.height,
    animation: resolvedAnimation,
    watermark,
    measureText,
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
): BarListLayout {
  return {
    area: { x: 0, y: 0, width: 0, height: 0 },
    chrome,
    rows: [],
    tooltipDescriptors: new Map(),
    a11y: {
      altText: 'Empty bar list',
      dataTableFallback: [],
      role: 'list',
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
