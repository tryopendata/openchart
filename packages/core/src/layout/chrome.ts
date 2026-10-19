/**
 * Chrome layout computation.
 *
 * Takes a Chrome spec + resolved theme and produces a ResolvedChrome
 * with computed text positions, styles, and total chrome heights.
 *
 * Supports three chrome modes:
 * - full: all chrome elements rendered at normal size
 * - compact: title only, no subtitle/source/byline/footer
 * - hidden: no chrome at all (maximizes chart area)
 *
 * Font sizes scale down continuously at narrow widths to keep
 * chrome proportional to the container.
 */

import type { ChromeMode } from '../responsive/breakpoints';
import type {
  MeasureTextFn,
  ResolvedChrome,
  ResolvedChromeElement,
  ResolvedChromeRule,
  TextStyle,
} from '../types/layout';
import type { Chrome, ChromeText } from '../types/spec';
import type { ChromeDefaults, ResolvedTheme } from '../types/theme';
import {
  BRAND_FONT_SIZE,
  BRAND_MIN_WIDTH,
  COMPACT_WIDTH,
  estimateCharWidth,
  estimateTextHeight,
} from './text-measure';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a chrome field to text + optional style and offset overrides. */
function normalizeChromeText(
  value: string | ChromeText | undefined,
): { text: string; style?: ChromeText['style']; offset?: ChromeText['offset'] } | null {
  if (value === undefined) return null;
  if (typeof value === 'string') return { text: value };
  return { text: value.text, style: value.style, offset: value.offset };
}

/**
 * Scale a font size based on container width. Only applies to default sizes
 * (not user overrides). Scales from 100% at >= 500px down to 72% at <= 250px.
 */
function scaleFontSize(baseFontSize: number, width: number): number {
  if (width >= 500) return baseFontSize;
  if (width <= 250) return Math.max(Math.round(baseFontSize * 0.72), 10);
  const t = (width - 250) / 250;
  return Math.max(Math.round(baseFontSize * (0.72 + t * 0.28)), 10);
}

/**
 * Extra scale applied to the default compact title font size in the 100-199px
 * cramped height range (see `computeChrome`'s `crampedTitle` param).
 */
const CRAMPED_TITLE_SCALE = 0.65;

/** Build a TextStyle from chrome defaults + optional overrides, with width-based scaling. */
function buildTextStyle(
  defaults: ChromeDefaults,
  fontFamily: string,
  textColor: string,
  width: number,
  overrides?: ChromeText['style'],
  extraScale = 1,
): TextStyle {
  const hasExplicitSize = overrides?.fontSize !== undefined;
  const baseFontSize = overrides?.fontSize ?? defaults.fontSize;
  const fontSize = hasExplicitSize
    ? baseFontSize
    : Math.max(Math.round(scaleFontSize(baseFontSize, width) * extraScale), 10);

  // No dominantBaseline: chrome y positions are top-edge coordinates and
  // renderers convert to the alphabetic baseline via textAscent(). WebKit
  // renders `hanging` from different font metrics than Blink and never
  // inherits it into tspans (bugs 139258/297455), which shifted wrapped
  // titles above the container on iOS Safari.
  return {
    fontFamily: overrides?.fontFamily ?? fontFamily,
    fontSize,
    fontWeight: overrides?.fontWeight ?? defaults.fontWeight,
    fill: overrides?.color ?? textColor ?? defaults.color,
    lineHeight: defaults.lineHeight,
    textAnchor: 'start',
  };
}

/**
 * Estimate how many lines text will wrap to, given a max width.
 * Uses character-count word-wrapping that matches the SVG renderer's
 * wrapText behavior (word-boundary breaks, same charWidth heuristic).
 * Returns at least 1.
 */
function estimateLineCount(
  text: string,
  style: TextStyle,
  maxWidth: number,
  measureText?: MeasureTextFn,
  maxLines?: number,
): number {
  if (maxWidth <= 0) return 1;

  // Split on explicit newlines first, then estimate wrapping per segment
  const segments = text.split('\n');
  if (segments.length > 1) {
    const count = segments.reduce((total, segment) => {
      return (
        total +
        (segment.length === 0 ? 1 : estimateLineCount(segment, style, maxWidth, measureText))
      );
    }, 0);
    return maxLines != null ? Math.min(count, maxLines) : count;
  }

  // Use real text measurement when available, fall back to heuristic
  if (measureText) {
    const textWidth = measureText(text, style.fontSize, style.fontWeight).width;
    if (textWidth <= maxWidth) return 1;

    const words = text.split(' ');
    let lines = 1;
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const candidateWidth = measureText(candidate, style.fontSize, style.fontWeight).width;
      if (candidateWidth > maxWidth && current) {
        lines++;
        current = word;
      } else {
        current = candidate;
      }
    }

    return maxLines != null ? Math.min(lines, maxLines) : lines;
  }

  const charWidth = estimateCharWidth(style.fontSize, style.fontWeight);
  const maxChars = Math.floor(maxWidth / charWidth);

  if (text.length <= maxChars) return 1;

  const words = text.split(' ');
  let lines = 1;
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines++;
      current = word;
    } else {
      current = candidate;
    }
  }

  return maxLines != null ? Math.min(lines, maxLines) : lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Line-height multiplier for the auto-thinning footnote list.
 *
 * Exported because the chrome renderer steps each footnote line down by it
 * while the band height below is computed from it -- the two have to agree, or
 * the last line drifts outside the band that was reserved for it.
 */
export const FOOTNOTE_LINE_HEIGHT = 1.3;
/** Gap below the footnote list, separating it from the source row. */
const FOOTNOTE_BAND_GAP = 4;

/** Internal compiler arithmetic and compatibility fallback for hand-built layouts. */
export function computeNoteBandHeight(
  input: number | Pick<ResolvedChrome, 'noteBandHeight' | 'footnotes' | 'seriesSummary'>,
  theme: ResolvedTheme,
): number {
  if (typeof input !== 'number' && input.noteBandHeight !== undefined) return input.noteBandHeight;
  const count =
    typeof input === 'number'
      ? input
      : (input.footnotes?.reduce((sum, note) => sum + (note.lines?.length ?? 1), 0) ?? 0) +
        (input.seriesSummary?.reduce((sum, entry) => sum + entry.lines.length, 0) ?? 0);
  return count <= 0
    ? 0
    : count * theme.fonts.sizes.small * FOOTNOTE_LINE_HEIGHT + FOOTNOTE_BAND_GAP;
}

function measuredWatermark(
  theme: ResolvedTheme,
  width: number,
  pad: number,
  y: number,
  measureText?: MeasureTextFn,
): ResolvedChromeElement | undefined {
  if (width < BRAND_MIN_WIDTH) return undefined;
  const style: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: BRAND_FONT_SIZE,
    fontWeight: 600,
    fill: theme.colors.axis,
    textAnchor: 'end',
    lineHeight: 1.3,
  };
  return {
    text: 'OpenData',
    x: width - pad,
    y,
    maxWidth:
      measureText?.('OpenData', BRAND_FONT_SIZE, 600).width ??
      'OpenData'.length * estimateCharWidth(BRAND_FONT_SIZE, 600),
    style,
  };
}

/**
 * Compute resolved chrome layout from a Chrome spec and resolved theme.
 *
 * Produces positioned text elements and total chrome heights (top and bottom).
 * Top chrome: title, subtitle. Bottom chrome: source, byline, footer.
 *
 * @param chrome - The Chrome spec from the user's VizSpec.
 * @param theme - The fully resolved theme.
 * @param width - Total available width in pixels.
 * @param measureText - Optional real text measurement function from the adapter.
 * @param chromeMode - Chrome display mode: full, compact (title only), or hidden.
 * @param padding - Override padding (for scaled padding from dimensions).
 * @param watermark - Whether the brand watermark renders (affects bottom space).
 * @param bottomLegendHeight - Reserved height for a bottom-positioned legend
 *   (legend bounds height + gap). When > 0, source/byline/footer y positions
 *   are shifted down by this amount so the chrome stacks BELOW the legend
 *   rather than colliding with it. The returned `bottomHeight` includes this
 *   reservation, so callers should not double-reserve it in margin math.
 * @param crampedTitle - Shrinks the default (non-explicit) title font size by
 *   `CRAMPED_TITLE_SCALE` on top of the width-based scaling. Set by callers for the
 *   100-199px cramped height range: at that height a full-size compact title
 *   can push `chrome.topHeight` past the min-chart-height guardrail, which
 *   would strip the title back out via the hidden-chrome fallback.
 */
export function computeChrome(
  chrome: Chrome | undefined,
  theme: ResolvedTheme,
  width: number,
  measureText?: MeasureTextFn,
  chromeMode: ChromeMode = 'full',
  padding?: number,
  watermark: boolean = true,
  bottomLegendHeight: number = 0,
  crampedTitle: boolean = false,
): ResolvedChrome {
  if (!chrome || chromeMode === 'hidden') {
    // `watermark` is still true here in two cases: the user explicitly opted
    // in at a cramped height (the compiler suppresses the default there), or
    // the chromeEatsPlot/min-dims fallback hid chrome at a normal height where
    // the default watermark was never suppressed. Reserve the brand band for
    // both so the brand doesn't paint over the plot's bottom edge.
    if (watermark && width >= BRAND_MIN_WIDTH) {
      const hiddenPad = padding ?? theme.spacing.padding;
      const brandHeight = estimateTextHeight(BRAND_FONT_SIZE, 1);
      return {
        topHeight: 0,
        bottomHeight: theme.spacing.chartToFooter + brandHeight + hiddenPad + bottomLegendHeight,
        watermark: measuredWatermark(
          theme,
          width,
          hiddenPad,
          theme.spacing.chartToFooter + bottomLegendHeight,
          measureText,
        ),
      };
    }
    if (bottomLegendHeight > 0) {
      // No brand band, but a bottom legend was reserved upstream. Surface the
      // reservation through bottomHeight so margin math stays additive, same
      // as the compact branch below.
      return { topHeight: 0, bottomHeight: bottomLegendHeight };
    }
    return { topHeight: 0, bottomHeight: 0 };
  }

  const pad = padding ?? theme.spacing.padding;
  const chromeGap = theme.spacing.chromeGap;
  // Subtract a small buffer beyond padding so the heuristic char-width
  // estimate triggers word-wrap before the real font overflows the container.
  const WRAP_SAFETY_BUFFER = 5;
  const maxWidth = width - pad * 2 - WRAP_SAFETY_BUFFER;
  const fontFamily = theme.fonts.family;

  // Track vertical cursor for top elements
  let topY = pad;
  const topElements: Partial<Pick<ResolvedChrome, 'eyebrow' | 'title' | 'subtitle'>> = {};

  // Eyebrow (hidden in compact mode — same rule as subtitle, keeps the
  // title alone at narrow viewports).
  const eyebrowNorm = chromeMode === 'compact' ? null : normalizeChromeText(chrome.eyebrow);
  const titleNormPeek = normalizeChromeText(chrome.title);
  const subtitleNormPeek = chromeMode === 'compact' ? null : normalizeChromeText(chrome.subtitle);

  // Editorial rule (theme.rule): a short colored bar above the block. Only
  // drawn when there is top chrome for it to sit above; it reserves its own
  // thickness plus one chromeGap, exactly like a text element.
  let ruleElement: ResolvedChromeRule | undefined;
  if (theme.rule && (eyebrowNorm || titleNormPeek || subtitleNormPeek)) {
    ruleElement = {
      x: pad,
      y: topY,
      width: theme.rule.width,
      thickness: theme.rule.thickness,
      color: theme.rule.color,
    };
    topY += theme.rule.thickness + chromeGap;
  }

  if (eyebrowNorm) {
    const style = buildTextStyle(
      theme.chrome.eyebrow,
      fontFamily,
      theme.chrome.eyebrow.color,
      width,
      eyebrowNorm.style,
    );
    const maxLines = eyebrowNorm.style?.maxLines;
    const lineCount = estimateLineCount(eyebrowNorm.text, style, maxWidth, measureText, maxLines);
    const element: ResolvedChromeElement = {
      text: eyebrowNorm.text,
      x: pad + (eyebrowNorm.offset?.dx ?? 0),
      y: topY + (eyebrowNorm.offset?.dy ?? 0),
      maxWidth,
      ...(maxLines != null ? { maxLines } : {}),
      style,
    };
    topElements.eyebrow = element;
    topY += estimateTextHeight(style.fontSize, lineCount, style.lineHeight) + chromeGap;
  }

  // Title
  const titleNorm = titleNormPeek;
  if (titleNorm) {
    const style = buildTextStyle(
      theme.chrome.title,
      fontFamily,
      theme.chrome.title.color,
      width,
      titleNorm.style,
      crampedTitle ? CRAMPED_TITLE_SCALE : 1,
    );
    const maxLines = titleNorm.style?.maxLines;
    const lineCount = estimateLineCount(titleNorm.text, style, maxWidth, measureText, maxLines);
    const element: ResolvedChromeElement = {
      text: titleNorm.text,
      x: pad + (titleNorm.offset?.dx ?? 0),
      y: topY + (titleNorm.offset?.dy ?? 0),
      maxWidth,
      ...(maxLines != null ? { maxLines } : {}),
      style,
    };
    topElements.title = element;
    topY += estimateTextHeight(style.fontSize, lineCount, style.lineHeight) + chromeGap;
  }

  // Subtitle (hidden in compact mode)
  const subtitleNorm = subtitleNormPeek;
  if (subtitleNorm) {
    const style = buildTextStyle(
      theme.chrome.subtitle,
      fontFamily,
      theme.chrome.subtitle.color,
      width,
      subtitleNorm.style,
    );
    const maxLines = subtitleNorm.style?.maxLines;
    const lineCount = estimateLineCount(subtitleNorm.text, style, maxWidth, measureText, maxLines);
    const element: ResolvedChromeElement = {
      text: subtitleNorm.text,
      x: pad + (subtitleNorm.offset?.dx ?? 0),
      y: topY + (subtitleNorm.offset?.dy ?? 0),
      maxWidth,
      ...(maxLines != null ? { maxLines } : {}),
      style,
    };
    topElements.subtitle = element;
    topY += estimateTextHeight(style.fontSize, lineCount, style.lineHeight) + chromeGap;
  }

  // Add chromeToChart gap if there are any top elements. Tighten on narrow
  // viewports so the subtitle doesn't float far above a legend or chart area.
  const hasTopChrome = eyebrowNorm || titleNorm || subtitleNorm;
  const chromeToChart =
    width < COMPACT_WIDTH ? Math.min(theme.spacing.chromeToChart, 2) : theme.spacing.chromeToChart;
  const topHeight = hasTopChrome ? topY - pad + chromeToChart - chromeGap : 0;

  // Bottom chrome text hidden in compact mode, but brand watermark still
  // renders for wide-enough charts. Reserve space so it doesn't overflow.
  if (chromeMode === 'compact') {
    let compactBottom = 0;
    if (watermark && width >= BRAND_MIN_WIDTH) {
      const brandHeight = estimateTextHeight(BRAND_FONT_SIZE, 1);
      compactBottom = theme.spacing.chartToFooter + brandHeight + pad + bottomLegendHeight;
    } else if (bottomLegendHeight > 0) {
      // No bottom chrome content but a bottom legend was reserved upstream.
      // Surface the reservation through bottomHeight so margin math stays
      // additive and consistent with full mode.
      compactBottom = bottomLegendHeight;
    }
    return {
      topHeight,
      bottomHeight: compactBottom,
      ...(watermark
        ? {
            watermark: measuredWatermark(
              theme,
              width,
              pad,
              theme.spacing.chartToFooter + bottomLegendHeight,
              measureText,
            ),
          }
        : {}),
      ...(ruleElement ? { rule: ruleElement } : {}),
      ...topElements,
    };
  }

  // Attribution is measured as a unit. Compare inline versus stacked using
  // the same wrapping model as painted text; ties favor inline. Never reduce
  // an authored font size or remeasure in response to interaction state.
  const startY = theme.spacing.chartToFooter + bottomLegendHeight;
  const brandNorm = normalizeChromeText(chrome.brand);
  const watermarkElement =
    watermark && !brandNorm ? measuredWatermark(theme, width, pad, startY, measureText) : undefined;
  let brandElement: ResolvedChromeElement | undefined;
  if (brandNorm && width >= BRAND_MIN_WIDTH) {
    const style = buildTextStyle(
      theme.chrome.footer,
      fontFamily,
      theme.chrome.footer.color,
      width,
      brandNorm.style,
    );
    style.textAnchor = 'end';
    const naturalWidth = Math.max(
      ...brandNorm.text
        .split('\n')
        .map(
          (line) =>
            measureText?.(line, style.fontSize, style.fontWeight).width ??
            line.length * estimateCharWidth(style.fontSize, style.fontWeight),
        ),
    );
    brandElement = {
      text: brandNorm.text,
      x: width - pad + (brandNorm.offset?.dx ?? 0),
      y: startY + (brandNorm.offset?.dy ?? 0),
      maxWidth: Math.max(1, Math.min(maxWidth, naturalWidth)),
      ...(brandNorm.style?.maxLines != null ? { maxLines: brandNorm.style.maxLines } : {}),
      style,
    };
  }
  const brand = brandElement ?? watermarkElement;
  const brandHeight = brand
    ? estimateTextHeight(
        brand.style.fontSize,
        estimateLineCount(brand.text, brand.style, brand.maxWidth, measureText, brand.maxLines),
        brand.style.lineHeight,
      )
    : 0;
  const items = (['source', 'byline', 'footer'] as const).flatMap((key) => {
    const norm = normalizeChromeText(chrome[key]);
    return norm
      ? [
          {
            key,
            norm,
            style: buildTextStyle(
              theme.chrome[key],
              fontFamily,
              theme.chrome[key].color,
              width,
              norm.style,
            ),
          },
        ]
      : [];
  });
  const gap = Math.max(12, chromeGap);
  // Account for authored horizontal movement when deciding fit. Explicit
  // offsets still win; the planner doesn't silently rewrite their intent.
  const inlineWidth = brand ? Math.max(0, brand.x - brand.maxWidth - gap - pad) : maxWidth;
  function resolveItems(availableWidth: number) {
    const elements: Partial<Pick<ResolvedChrome, 'source' | 'byline' | 'footer'>> = {};
    let y = startY;
    let extent = startY;
    for (const { key, norm, style } of items) {
      const available = Math.max(1, availableWidth - Math.max(0, norm.offset?.dx ?? 0));
      const count = estimateLineCount(
        norm.text,
        style,
        available,
        measureText,
        norm.style?.maxLines,
      );
      const height = estimateTextHeight(style.fontSize, count, style.lineHeight);
      const itemY = y + (norm.offset?.dy ?? 0);
      elements[key] = {
        text: norm.text,
        x: pad + (norm.offset?.dx ?? 0),
        y: itemY,
        maxWidth: available,
        ...(norm.style?.maxLines != null ? { maxLines: norm.style.maxLines } : {}),
        style,
      };
      extent = Math.max(extent, itemY + height);
      y += height + chromeGap;
    }
    return {
      elements,
      extent,
      height: items.length ? Math.max(y - chromeGap, extent) - startY : 0,
    };
  }
  const full = resolveItems(maxWidth);
  const inline = resolveItems(inlineWidth);
  const inlineHeight = Math.max(inline.height, (brand?.y ?? startY) - startY + brandHeight);
  const stackedHeight =
    full.height +
    (items.length ? chromeGap : 0) +
    brandHeight +
    Math.max(0, brandNorm?.offset?.dy ?? 0);
  const stacked = !!brand && items.length > 0 && (inlineWidth < 40 || stackedHeight < inlineHeight);
  const bottomElements = stacked ? full.elements : inline.elements;
  if (stacked && brand) brand.y += full.height + chromeGap;
  const contentHeight = stacked ? stackedHeight : inlineHeight;
  const bottomHeight = items.length || brand ? startY + contentHeight + pad : bottomLegendHeight;

  return {
    topHeight,
    bottomHeight,
    ...(ruleElement ? { rule: ruleElement } : {}),
    ...topElements,
    ...bottomElements,
    ...(brandElement ? { brand: brandElement } : {}),
    ...(watermarkElement ? { watermark: watermarkElement } : {}),
    ...(items.length || brand ? { attributionLayout: stacked ? 'stacked' : 'inline' } : {}),
  };
}
