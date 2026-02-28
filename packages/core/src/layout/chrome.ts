/**
 * Chrome layout computation.
 *
 * Takes a Chrome spec + resolved theme and produces a ResolvedChrome
 * with computed text positions, styles, and total chrome heights.
 */

import type {
  MeasureTextFn,
  ResolvedChrome,
  ResolvedChromeElement,
  TextStyle,
} from '../types/layout';
import type { Chrome, ChromeText } from '../types/spec';
import type { ChromeDefaults, ResolvedTheme } from '../types/theme';
import { estimateTextHeight, estimateTextWidth } from './text-measure';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a chrome field to text + optional style overrides. */
function normalizeChromeText(
  value: string | ChromeText | undefined,
): { text: string; style?: ChromeText['style'] } | null {
  if (value === undefined) return null;
  if (typeof value === 'string') return { text: value };
  return { text: value.text, style: value.style };
}

/** Build a TextStyle from chrome defaults + optional overrides. */
function buildTextStyle(
  defaults: ChromeDefaults,
  fontFamily: string,
  textColor: string,
  overrides?: ChromeText['style'],
): TextStyle {
  return {
    fontFamily: overrides?.fontFamily ?? fontFamily,
    fontSize: overrides?.fontSize ?? defaults.fontSize,
    fontWeight: overrides?.fontWeight ?? defaults.fontWeight,
    fill: overrides?.color ?? textColor ?? defaults.color,
    lineHeight: defaults.lineHeight,
    textAnchor: 'start',
    dominantBaseline: 'hanging',
  };
}

/** Measure text width using the provided function or heuristic fallback. */
function measureWidth(text: string, style: TextStyle, measureText?: MeasureTextFn): number {
  if (measureText) {
    return measureText(text, style.fontSize, style.fontWeight).width;
  }
  return estimateTextWidth(text, style.fontSize, style.fontWeight);
}

/**
 * Estimate how many lines text will wrap to, given a max width.
 * Returns at least 1.
 */
function estimateLineCount(
  text: string,
  style: TextStyle,
  maxWidth: number,
  measureText?: MeasureTextFn,
): number {
  const fullWidth = measureWidth(text, style, measureText);
  if (fullWidth <= maxWidth) return 1;
  return Math.ceil(fullWidth / maxWidth);
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
 */
export function computeChrome(
  chrome: Chrome | undefined,
  theme: ResolvedTheme,
  width: number,
  measureText?: MeasureTextFn,
): ResolvedChrome {
  if (!chrome) {
    return { topHeight: 0, bottomHeight: 0 };
  }

  const padding = theme.spacing.padding;
  const chromeGap = theme.spacing.chromeGap;
  const maxWidth = width - padding * 2;
  const fontFamily = theme.fonts.family;

  // Track vertical cursor for top elements
  let topY = padding;
  const topElements: Partial<Pick<ResolvedChrome, 'title' | 'subtitle'>> = {};

  // Title
  const titleNorm = normalizeChromeText(chrome.title);
  if (titleNorm) {
    const style = buildTextStyle(
      theme.chrome.title,
      fontFamily,
      theme.chrome.title.color,
      titleNorm.style,
    );
    const lineCount = estimateLineCount(titleNorm.text, style, maxWidth, measureText);
    const element: ResolvedChromeElement = {
      text: titleNorm.text,
      x: padding,
      y: topY,
      maxWidth,
      style,
    };
    topElements.title = element;
    topY += estimateTextHeight(style.fontSize, lineCount, style.lineHeight) + chromeGap;
  }

  // Subtitle
  const subtitleNorm = normalizeChromeText(chrome.subtitle);
  if (subtitleNorm) {
    const style = buildTextStyle(
      theme.chrome.subtitle,
      fontFamily,
      theme.chrome.subtitle.color,
      subtitleNorm.style,
    );
    const lineCount = estimateLineCount(subtitleNorm.text, style, maxWidth, measureText);
    const element: ResolvedChromeElement = {
      text: subtitleNorm.text,
      x: padding,
      y: topY,
      maxWidth,
      style,
    };
    topElements.subtitle = element;
    topY += estimateTextHeight(style.fontSize, lineCount, style.lineHeight) + chromeGap;
  }

  // Add chromeToChart gap if there are any top elements
  const hasTopChrome = titleNorm || subtitleNorm;
  const topHeight = hasTopChrome ? topY - padding + theme.spacing.chromeToChart - chromeGap : 0;

  // Bottom elements: source, byline, footer
  // We compute heights bottom-up but position them after knowing total
  const bottomElements: Partial<Pick<ResolvedChrome, 'source' | 'byline' | 'footer'>> = {};
  let bottomHeight = 0;

  const bottomItems: Array<{
    key: 'source' | 'byline' | 'footer';
    norm: { text: string; style?: ChromeText['style'] };
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
      const style = buildTextStyle(item.defaults, fontFamily, item.defaults.color, item.norm.style);
      const lineCount = estimateLineCount(item.norm.text, style, maxWidth, measureText);
      const height = estimateTextHeight(style.fontSize, lineCount, style.lineHeight);

      // y positions will be computed relative to the bottom of the
      // chart area by the engine. We store offsets from bottom start.
      bottomElements[item.key] = {
        text: item.norm.text,
        x: padding,
        y: bottomHeight, // offset from where bottom chrome starts
        maxWidth,
        style,
      };

      bottomHeight += height + chromeGap;
    }

    // Remove trailing gap
    bottomHeight -= chromeGap;
    // Add bottom padding
    bottomHeight += padding;
  }

  return {
    topHeight,
    bottomHeight,
    ...topElements,
    ...bottomElements,
  };
}
