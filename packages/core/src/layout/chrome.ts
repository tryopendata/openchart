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
  TextStyle,
} from '../types/layout';
import type { Chrome, ChromeText } from '../types/spec';
import type { ChromeDefaults, ResolvedTheme } from '../types/theme';
import {
  BRAND_FONT_SIZE,
  BRAND_MIN_WIDTH,
  BRAND_RESERVE_WIDTH,
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

/** Build a TextStyle from chrome defaults + optional overrides, with width-based scaling. */
function buildTextStyle(
  defaults: ChromeDefaults,
  fontFamily: string,
  textColor: string,
  width: number,
  overrides?: ChromeText['style'],
): TextStyle {
  const hasExplicitSize = overrides?.fontSize !== undefined;
  const baseFontSize = overrides?.fontSize ?? defaults.fontSize;
  const fontSize = hasExplicitSize ? baseFontSize : scaleFontSize(baseFontSize, width);

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

/**
 * Vertical space a footnote list of `count` lines occupies below the plot.
 *
 * Single source of truth, deliberately: the engine reserves this band in the
 * bottom margin, the chrome renderer shifts the source row down by it, and the
 * brand watermark shifts by it too. When those three disagree the footnotes
 * land on top of the watermark, which is exactly the bug this centralizes away.
 */
export function footnoteBandHeight(count: number, theme: ResolvedTheme): number {
  if (count <= 0) return 0;
  return count * theme.fonts.sizes.small * FOOTNOTE_LINE_HEIGHT + FOOTNOTE_BAND_GAP;
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
  const titleNorm = normalizeChromeText(chrome.title);
  if (titleNorm) {
    const style = buildTextStyle(
      theme.chrome.title,
      fontFamily,
      theme.chrome.title.color,
      width,
      titleNorm.style,
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
  const subtitleNorm = chromeMode === 'compact' ? null : normalizeChromeText(chrome.subtitle);
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
      ...topElements,
    };
  }

  // Bottom elements: source, byline, footer, and an optional custom brand
  // (`chrome.brand`). When a custom brand is supplied it suppresses the default
  // tryOpenData.ai watermark and renders right-anchored on the same baseline.
  const brandNorm = normalizeChromeText(chrome.brand);
  const showWatermark = watermark && !brandNorm;
  // Reserve space on the right for the brand watermark or custom brand so the
  // left-anchored bottom chrome items don't overlap.
  const shouldReserveBrandWidth = (showWatermark || !!brandNorm) && width >= BRAND_MIN_WIDTH;
  const bottomMaxWidth = maxWidth - (shouldReserveBrandWidth ? BRAND_RESERVE_WIDTH : 0);
  const bottomElements: Partial<Pick<ResolvedChrome, 'source' | 'byline' | 'footer'>> = {};
  let bottomHeight = 0;

  const bottomItems: Array<{
    key: 'source' | 'byline' | 'footer';
    norm: { text: string; style?: ChromeText['style']; offset?: ChromeText['offset'] };
    defaults: ChromeDefaults;
  }> = [];

  const sourceNorm = normalizeChromeText(chrome.source);
  if (sourceNorm) {
    bottomItems.push({
      key: 'source',
      norm: sourceNorm,
      defaults: theme.chrome.source,
    });
  }

  const bylineNorm = normalizeChromeText(chrome.byline);
  if (bylineNorm) {
    bottomItems.push({
      key: 'byline',
      norm: bylineNorm,
      defaults: theme.chrome.byline,
    });
  }

  const footerNorm = normalizeChromeText(chrome.footer);
  if (footerNorm) {
    bottomItems.push({
      key: 'footer',
      norm: footerNorm,
      defaults: theme.chrome.footer,
    });
  }

  if (bottomItems.length > 0) {
    bottomHeight += theme.spacing.chartToFooter;
    // Push bottom chrome below the bottom legend (if reserved). Stored y values
    // include this offset so renderers don't need to know about the legend band.
    bottomHeight += bottomLegendHeight;

    for (const item of bottomItems) {
      const style = buildTextStyle(
        item.defaults,
        fontFamily,
        item.defaults.color,
        width,
        item.norm.style,
      );
      const maxLines = item.norm.style?.maxLines;
      const lineCount = estimateLineCount(
        item.norm.text,
        style,
        bottomMaxWidth,
        measureText,
        maxLines,
      );
      const height = estimateTextHeight(style.fontSize, lineCount, style.lineHeight);

      // y positions will be computed relative to the bottom of the
      // chart area by the engine. We store offsets from bottom start.
      bottomElements[item.key] = {
        text: item.norm.text,
        x: pad + (item.norm.offset?.dx ?? 0),
        y: bottomHeight + (item.norm.offset?.dy ?? 0), // offset from where bottom chrome starts
        maxWidth: bottomMaxWidth,
        ...(maxLines != null ? { maxLines } : {}),
        style,
      };

      bottomHeight += height + chromeGap;
    }

    // Remove trailing gap
    bottomHeight -= chromeGap;

    // Ensure bottom height accommodates the brand watermark, which renders
    // at the same Y as the first bottom chrome item but is taller (20px font
    // vs 12px source). Without this, the brand overflows the SVG viewBox.
    if (showWatermark && width >= BRAND_MIN_WIDTH) {
      const brandHeight = estimateTextHeight(BRAND_FONT_SIZE, 1);
      // firstItemY is chartToFooter (the Y offset of the first bottom item).
      // The brand needs brandHeight below that point; bottom chrome content
      // needs (bottomHeight - chartToFooter). Take the max.
      const contentBelowFirstItem = bottomHeight - theme.spacing.chartToFooter;
      if (brandHeight > contentBelowFirstItem) {
        bottomHeight += brandHeight - contentBelowFirstItem;
      }
    }

    // Add bottom padding
    bottomHeight += pad;
  } else if (showWatermark && width >= BRAND_MIN_WIDTH) {
    // No bottom chrome items, but brand watermark still renders.
    // Reserve space: chartToFooter gap + brand text height + padding,
    // plus the bottom-legend reservation so the watermark sits below it.
    const brandHeight = estimateTextHeight(BRAND_FONT_SIZE, 1);
    bottomHeight = theme.spacing.chartToFooter + brandHeight + pad + bottomLegendHeight;
  } else if (bottomLegendHeight > 0) {
    // No bottom chrome content and no watermark, but a bottom legend was
    // reserved upstream. Surface the reservation so callers don't need to
    // re-add it on top of bottomHeight.
    bottomHeight = bottomLegendHeight;
  }

  // Custom brand is right-anchored on the same row as the first bottom chrome
  // item. Compute its style/position once we know whether bottom chrome exists.
  let brandElement: ResolvedChromeElement | undefined;
  if (brandNorm && width >= BRAND_MIN_WIDTH) {
    const brandStyle = buildTextStyle(
      theme.chrome.footer,
      fontFamily,
      theme.chrome.footer.color,
      width,
      brandNorm.style,
    );
    brandStyle.textAnchor = 'end';
    // Y matches the first bottom item (chartToFooter offset). When there are
    // no bottom items, the brand becomes the sole footer element and we need
    // to allocate the same baseline.
    const brandY =
      bottomItems.length > 0 ? theme.spacing.chartToFooter : theme.spacing.chartToFooter;
    brandElement = {
      text: brandNorm.text,
      x: width - pad + (brandNorm.offset?.dx ?? 0),
      y: brandY + (brandNorm.offset?.dy ?? 0),
      maxWidth: BRAND_RESERVE_WIDTH,
      style: brandStyle,
    };
    // Ensure bottomHeight reserves space when brand is the only footer item.
    if (bottomItems.length === 0) {
      const brandHeight = estimateTextHeight(brandStyle.fontSize, 1, brandStyle.lineHeight);
      bottomHeight = theme.spacing.chartToFooter + brandHeight + pad;
    }
  }

  return {
    topHeight,
    bottomHeight,
    ...topElements,
    ...bottomElements,
    ...(brandElement ? { brand: brandElement } : {}),
  };
}
