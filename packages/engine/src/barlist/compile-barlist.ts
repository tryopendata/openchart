import { mergeThemeConfig } from '@opendata-ai/openchart-core';
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
  CompileWarning,
  ResolvedAnimation,
  ResolvedTheme,
  TextStyle,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  computeChrome,
  estimateTextWidth,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { descriptionForRows, identityForRows } from '../charts/_shared/mark-metadata';
import { emitSpecWarnings, expandSpecSugar } from '../compile/spec-sugar';
import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { finiteNumber } from '../data/finite-number';
import { resolveFieldFormatter } from '../format/field-format';
import { resolveChromeLayout } from '../layout/shared';
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
  // Expand deprecated top-level sugar (valueFormat -> encoding.value.format)
  // before validation, then validate + normalize via the shared pipeline.
  const sugarWarnings: string[] = [];
  const expandedSpec =
    spec && typeof spec === 'object' && !Array.isArray(spec)
      ? expandSpecSugar(spec as Record<string, unknown>, sugarWarnings)
      : spec;
  const { spec: normalized, warnings } = compileSpec(expandedSpec);
  emitSpecWarnings([...sugarWarnings, ...warnings], options.onWarn);

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
  const mergedThemeConfig = mergeThemeConfig(barlistSpec.theme, options.theme);
  const lightTheme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  let theme: ResolvedTheme = lightTheme;
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  // Compute chrome
  const chrome = computeChrome(
    barlistSpec.chrome,
    theme,
    options.width,
    options.measureText,
    'full',
    undefined,
    watermark,
  );

  const padding = theme.spacing.padding;
  const labelField = barlistSpec.encoding.label.field;
  const valueField = barlistSpec.encoding.value.field;
  const subtitleField = barlistSpec.encoding.subtitle?.field;
  const colorField = barlistSpec.encoding.color?.field;
  const groupField = barlistSpec.encoding.group?.field;
  const barHeight = barlistSpec.barHeight;
  const cornerRadius =
    barlistSpec.cornerRadius === 'pill' ? barHeight / 2 : barlistSpec.cornerRadius;
  const rowContentHeight = Math.max(barHeight, LABEL_FONT_SIZE * 1.4);
  const rowHeight = rowContentHeight + DEFAULT_ROW_GAP;
  const groupHeight = groupField ? LABEL_FONT_SIZE * 1.4 + DEFAULT_ROW_GAP : 0;
  const annotationLane = barlistSpec.annotations?.some((annotation) => annotation.label)
    ? theme.fonts.sizes.small * 1.5
    : 0;
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const row of barlistSpec.data) {
    if (finiteNumber(row[valueField]) === undefined) continue;
    const group = groupField ? String(row[groupField] ?? '') : '';
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group)!.push(row);
  }
  const candidates = [...buckets.values()]
    .flatMap((rows) =>
      barlistSpec.sort === null
        ? rows
        : rows
            .slice()
            .sort(
              (a, b) =>
                (barlistSpec.sort === 'ascending' ? 1 : -1) *
                (Number(a[valueField]) - Number(b[valueField])),
            ),
    )
    .slice(0, barlistSpec.maxItems);
  const groupsCount = groupField
    ? new Set(candidates.map((row) => String(row[groupField] ?? ''))).size
    : 0;
  const chromeLayout = resolveChromeLayout(spec as { chromeLayout?: 'subtract' | 'grow' }, options);
  const auto = barlistSpec.height === 'auto';
  const baseHeight = auto
    ? candidates.length * rowHeight +
      groupsCount * groupHeight +
      annotationLane +
      padding * 2 +
      (chromeLayout === 'grow' ? 0 : chrome.topHeight + chrome.bottomHeight)
    : typeof barlistSpec.height === 'number'
      ? barlistSpec.height
      : options.height;
  const grownHeight =
    chromeLayout === 'grow' ? baseHeight + chrome.topHeight + chrome.bottomHeight : baseHeight;
  const fullArea = {
    x: padding,
    y: padding + chrome.topHeight + annotationLane,
    width: options.width - padding * 2,
    height:
      baseHeight -
      padding * 2 -
      annotationLane -
      (chromeLayout === 'grow' ? 0 : chrome.topHeight + chrome.bottomHeight),
  };
  const validRows: Record<string, unknown>[] = [];
  const rowPositions: number[] = [];
  const groupPositions: Array<{ key: string; y: number }> = [];
  let cursorY = fullArea.y;
  let previousGroup: string | undefined;
  for (const row of candidates) {
    const group = groupField ? String(row[groupField] ?? '') : '';
    const newGroup = groupField !== undefined && group !== previousGroup;
    const header = newGroup ? groupHeight : 0;
    // Always keep the first row when there is any plot area, as rc.2 did:
    // a height shorter than one row still shows the top item.
    const fits = cursorY + header + rowHeight <= fullArea.y + fullArea.height + 1e-9;
    if (!fits && (validRows.length > 0 || fullArea.height <= 0)) break;
    if (newGroup) {
      groupPositions.push({ key: group, y: cursorY });
      cursorY += groupHeight;
    }
    validRows.push(row);
    rowPositions.push(cursorY);
    cursorY += rowHeight;
    previousGroup = group;
  }
  const compileWarnings: CompileWarning[] = [];
  const droppedCount = candidates.length - validRows.length;
  // Only an authored numeric height warns: the author can switch it to 'auto'.
  // A container-driven cap re-fits on every resize and stays silent, as in rc.2.
  if (droppedCount > 0 && typeof barlistSpec.height === 'number') {
    const message = `Bar list height drops ${droppedCount} rows; use height: 'auto' to fit every row.`;
    compileWarnings.push({ code: 'BARLIST_ROWS_DROPPED', message, context: { droppedCount } });
    emitSpecWarnings([message], options.onWarn);
  }
  if (fullArea.width <= 0 || validRows.length === 0) {
    const empty = emptyLayout(chrome, theme, { ...options, height: grownHeight }, watermark);
    return {
      ...empty,
      warnings: compileWarnings,
      a11y: {
        ...empty.a11y,
        altText: barlistSpec.a11y?.description ?? 'Empty bar list',
        hidden: barlistSpec.a11y?.hidden,
      },
    };
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

  // Value formatter: prefer encoding-level format (v8 canonical), fall back to deprecated valueFormat
  const formatter = resolveFieldFormatter({
    surfaceFormat: barlistSpec.labels?.format ?? barlistSpec.encoding.value.format,
    values: validRows.map((r) => r[valueField]),
  });

  const formatValue = (value: number) =>
    `${barlistSpec.labels?.prefix ?? ''}${formatter(value)}${barlistSpec.labels?.suffix ?? ''}`;

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
  const defaultValueWidth = isNarrow ? 44 : VALUE_WIDTH;
  const valueWidth = barlistSpec.labels
    ? Math.max(
        defaultValueWidth,
        ...validRows.map(
          (row) =>
            measureText(formatValue(Number(row[valueField])), VALUE_FONT_SIZE, VALUE_FONT_WEIGHT)
              .width + 4,
        ),
      )
    : defaultValueWidth;
  const maxLabelPct = isNarrow ? 0.35 : 0.4;
  const labelWidth = Math.max(50, Math.min(maxCombinedWidth, fullArea.width * maxLabelPct));

  const barAreaWidth = fullArea.width - labelWidth - labelBarGap - barValueGap - valueWidth;

  // Ellipsize `text` to fit `budget` px, given its untruncated `fullWidth`.
  // The trim is seeded proportionally (plus a safety margin) so the loop costs
  // a handful of measureText calls per row instead of one per character.
  const ellipsize = (
    text: string,
    fullWidth: number,
    budget: number,
    fontSize: number,
    fontWeight: number,
  ): { text: string; width: number } => {
    const seedLen = Math.min(text.length, Math.ceil((text.length * budget) / fullWidth) + 2);
    let t = text.slice(0, seedLen);
    while (t.length > 1 && measureText(`${t.trimEnd()}…`, fontSize, fontWeight).width > budget) {
      t = t.slice(0, -1);
    }
    const out = `${t.trimEnd()}…`;
    return { text: out, width: measureText(out, fontSize, fontWeight).width };
  };

  const labelColor = theme.colors.text;
  const subtitleColor = options.darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const valueColor = options.darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

  // Build row marks
  const rows: BarListRowMark[] = [];

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const value = Number(row[valueField]);
    const labelText = String(row[labelField] ?? '');
    const formattedValue = formatValue(value);
    const barColor = getColor(row, i);
    const domain = barlistSpec.encoding.value.scale?.domain as number[] | undefined;
    const pct = domain
      ? Math.max(0, Math.min(1, (value - domain[0]) / (domain[1] - domain[0])))
      : maxValue > 0
        ? Math.abs(value) / maxValue
        : 0;

    const rowY = rowPositions[i];
    const centerY = rowY + rowContentHeight / 2;

    // Label (left-aligned). Labels longer than the label column are
    // ellipsized for display — without this they run underneath the bar
    // track. The full text is preserved in the row's aria label.
    const labelX = fullArea.x;
    let displayLabel = labelText;
    let displayLabelW = perRowLabelWidths.get(i) ?? 0;
    if (displayLabelW > labelWidth) {
      ({ text: displayLabel, width: displayLabelW } = ellipsize(
        labelText,
        displayLabelW,
        labelWidth,
        LABEL_FONT_SIZE,
        LABEL_FONT_WEIGHT,
      ));
    }
    const labelStyle: TextStyle = {
      fontFamily: theme.fonts.family,
      fontSize: LABEL_FONT_SIZE,
      fontWeight: LABEL_FONT_WEIGHT,
      fill: labelColor,
      lineHeight: 1.4,
    };

    // Subtitle (left-aligned, positioned after this row's measured label width
    // + gap). The subtitle must also fit inside the label column: when the
    // (possibly truncated) label leaves too little room, the subtitle is
    // ellipsized into the remainder, or dropped when not even one character
    // plus an ellipsis fits.
    let subtitle: BarListRowMark['subtitle'];
    if (subtitleField && row[subtitleField] != null) {
      let subtitleText = String(row[subtitleField]);
      const subtitleBudget = labelWidth - displayLabelW - 6;
      const subtitleW = measureText(subtitleText, SUBTITLE_FONT_SIZE, SUBTITLE_FONT_WEIGHT).width;
      if (subtitleW > subtitleBudget) {
        const minW = measureText('W…', SUBTITLE_FONT_SIZE, SUBTITLE_FONT_WEIGHT).width;
        if (subtitleBudget < minW) {
          subtitleText = '';
        } else {
          ({ text: subtitleText } = ellipsize(
            subtitleText,
            subtitleW,
            subtitleBudget,
            SUBTITLE_FONT_SIZE,
            SUBTITLE_FONT_WEIGHT,
          ));
        }
      }
      if (subtitleText) {
        const subtitleX = labelX + displayLabelW + 6;
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
      markType: 'bar',
      fullLabel: labelText,
      identity: identityForRows(
        {
          y: { ...barlistSpec.encoding.label, type: 'nominal' },
          color: barlistSpec.encoding.color,
          detail: barlistSpec.encoding.group,
        },
        [row],
      ),
      authoredDescription: descriptionForRows(
        { description: barlistSpec.encoding.description },
        [row],
        [],
      ),
      index: i,
      y: rowY,
      height: rowHeight,
      label: {
        text: displayLabel,
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
        label:
          descriptionForRows({ description: barlistSpec.encoding.description }, [row], []) ??
          `${labelText}: ${formattedValue}`,
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
    altText:
      barlistSpec.a11y?.description ??
      `Bar list showing ${rows.length} items ranked by ${valueField}`,
    hidden: barlistSpec.a11y?.hidden,
    dataTableFallback: rows.map((r) => [r.label.text, r.formattedValue]),
    role: 'list' as const,
    keyboardNavigable: !barlistSpec.a11y?.hidden && rows.length > 0,
  };

  const groups = groupPositions.map(({ key, y }, index) => ({
    key,
    label: {
      text: key,
      x: fullArea.x,
      y: y + groupHeight / 2,
      visible: true,
      style: {
        fontFamily: theme.fonts.family,
        fontSize: LABEL_FONT_SIZE,
        fontWeight: LABEL_FONT_WEIGHT,
        fill: theme.colors.neutral.secondary,
        lineHeight: 1.4,
      },
    },
    ...(index ? { separator: { x1: fullArea.x, x2: fullArea.x + fullArea.width, y } } : {}),
  }));
  const firstTrack = rows[0].track;
  const domain = barlistSpec.encoding.value.scale?.domain as number[] | undefined;
  const [lower, upper] = domain ?? [0, maxValue];
  // Like chart reference lines whose value is off the scale, a reference
  // outside the value domain is dropped rather than drawn past the track.
  const referenceLines = (barlistSpec.annotations ?? []).flatMap((annotation) => {
    if (annotation.x < Math.min(lower, upper) || annotation.x > Math.max(lower, upper)) return [];
    const x = firstTrack.x + ((annotation.x - lower) / (upper - lower || 1)) * firstTrack.width;
    return {
      x,
      y1: fullArea.y,
      y2: cursorY,
      stroke: annotation.stroke ?? theme.colors.axis,
      strokeWidth: annotation.strokeWidth ?? 1,
      strokeDasharray:
        annotation.strokeDash?.join(',') ??
        (annotation.style === 'dashed' ? '4,4' : annotation.style === 'dotted' ? '1,3' : undefined),
      ...(annotation.label
        ? {
            label: {
              text: annotation.label,
              x,
              y: fullArea.y - 6,
              visible: true,
              style: {
                fontFamily: theme.fonts.family,
                fontSize: annotation.fontSize ?? theme.fonts.sizes.small,
                fontWeight: annotation.fontWeight ?? 400,
                fill: annotation.fill ?? theme.colors.axis,
                lineHeight: 1.4,
              },
            },
          }
        : {}),
    };
  });

  // Resolve animation
  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(barlistSpec.animation);

  return {
    area: fullArea,
    chrome,
    rows,
    groups,
    referenceLines,
    warnings: compileWarnings,
    tooltipDescriptors,
    a11y,
    theme,
    width: options.width,
    height: grownHeight,
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
