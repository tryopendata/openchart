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
import { BRAND_RESERVE_WIDTH, estimateCharWidth, estimateTextHeight } from './text-measure';

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

  return {
    fontFamily: overrides?.fontFamily ?? fontFamily,
    fontSize,
    fontWeight: overrides?.fontWeight ?? defaults.fontWeight,
    fill: overrides?.color ?? textColor ?? defaults.color,
    lineHeight: defaults.lineHeight,
    textAnchor: 'start',
    dominantBaseline: 'hanging',
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
  _measureText?: MeasureTextFn,
): number {
  if (maxWidth <= 0) return 1;

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

  return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
 */
export function computeChrome(
  chrome: Chrome | undefined,
  theme: ResolvedTheme,
  width: number,
  measureText?: MeasureTextFn,
  chromeMode: ChromeMode = 'full',
  padding?: number,
): ResolvedChrome {
  if (!chrome || chromeMode === 'hidden') {
    return { topHeight: 0, bottomHeight: 0 };
  }

  const pad = padding ?? theme.spacing.padding;
  const chromeGap = theme.spacing.chromeGap;
  const maxWidth = width - pad * 2;
  const fontFamily = theme.fonts.family;

  // Track vertical cursor for top elements
  let topY = pad;
  const topElements: Partial<Pick<ResolvedChrome, 'title' | 'subtitle'>> = {};

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
    const lineCount = estimateLineCount(titleNorm.text, style, maxWidth, measureText);
    const element: ResolvedChromeElement = {
      text: titleNorm.text,
      x: pad + (titleNorm.offset?.dx ?? 0),
      y: topY + (titleNorm.offset?.dy ?? 0),
      maxWidth,
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
    const lineCount = estimateLineCount(subtitleNorm.text, style, maxWidth, measureText);
    const element: ResolvedChromeElement = {
      text: subtitleNorm.text,
      x: pad + (subtitleNorm.offset?.dx ?? 0),
      y: topY + (subtitleNorm.offset?.dy ?? 0),
      maxWidth,
      style,
    };
    topElements.subtitle = element;
    topY += estimateTextHeight(style.fontSize, lineCount, style.lineHeight) + chromeGap;
  }

  // Add chromeToChart gap if there are any top elements
  const hasTopChrome = titleNorm || subtitleNorm;
  const topHeight = hasTopChrome ? topY - pad + theme.spacing.chromeToChart - chromeGap : 0;

  // Bottom elements hidden in compact mode
  if (chromeMode === 'compact') {
    return {
      topHeight,
      bottomHeight: 0,
      ...topElements,
    };
  }

  // Bottom elements: source, byline, footer
  // Reserve space on the right for the brand watermark so text doesn't overlap it
  const bottomMaxWidth = maxWidth - BRAND_RESERVE_WIDTH;
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

    for (const item of bottomItems) {
      const style = buildTextStyle(
        item.defaults,
        fontFamily,
        item.defaults.color,
        width,
        item.norm.style,
      );
      const lineCount = estimateLineCount(item.norm.text, style, bottomMaxWidth, measureText);
      const height = estimateTextHeight(style.fontSize, lineCount, style.lineHeight);

      // y positions will be computed relative to the bottom of the
      // chart area by the engine. We store offsets from bottom start.
      bottomElements[item.key] = {
        text: item.norm.text,
        x: pad + (item.norm.offset?.dx ?? 0),
        y: bottomHeight + (item.norm.offset?.dy ?? 0), // offset from where bottom chrome starts
        maxWidth: bottomMaxWidth,
        style,
      };

      bottomHeight += height + chromeGap;
    }

    // Remove trailing gap
    bottomHeight -= chromeGap;
    // Add bottom padding
    bottomHeight += pad;
  }

  return {
    topHeight,
    bottomHeight,
    ...topElements,
    ...bottomElements,
  };
}
