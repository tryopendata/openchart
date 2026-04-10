/**
 * Heuristic text measurement for environments without a DOM.
 *
 * These are intentionally approximate. Adapters can provide a real
 * measureText function via CompileOptions for higher accuracy.
 * The engine uses the real function when available, falls back to
 * these heuristics when not.
 */

/**
 * Average character width as a fraction of font size for Inter.
 * Inter is slightly wider than Helvetica, narrower than Courier.
 * This is a reasonable middle ground.
 */
const AVG_CHAR_WIDTH_RATIO = 0.57;

/** Narrower characters (i, l, t, etc.) bring the average down. */
const WEIGHT_ADJUSTMENT: Record<number, number> = {
  100: 0.9,
  200: 0.92,
  300: 0.95,
  400: 1.0,
  500: 1.02,
  600: 1.05,
  700: 1.08,
  800: 1.1,
  900: 1.12,
};

/**
 * Estimate the average character width for a given font size and weight.
 * Used by both text width estimation and word-wrap line counting.
 */
export function estimateCharWidth(fontSize: number, fontWeight = 400): number {
  const weightFactor = WEIGHT_ADJUSTMENT[fontWeight] ?? 1.0;
  return fontSize * AVG_CHAR_WIDTH_RATIO * weightFactor;
}

/**
 * Estimate the rendered width of a text string.
 *
 * Uses a per-character average width based on font size, adjusted
 * for font weight. Accurate to within ~20% for Latin text in Inter.
 *
 * @param text - The text string to measure.
 * @param fontSize - Font size in pixels.
 * @param fontWeight - Font weight (100-900). Defaults to 400.
 */
export function estimateTextWidth(text: string, fontSize: number, fontWeight = 400): number {
  const charWidth = estimateCharWidth(fontSize, fontWeight);
  // For multiline text, measure the longest line
  if (text.includes('\n')) {
    let maxLen = 0;
    for (const line of text.split('\n')) {
      if (line.length > maxLen) maxLen = line.length;
    }
    return maxLen * charWidth;
  }
  return text.length * charWidth;
}

/**
 * Width reserved for the "tryOpenData.ai" brand watermark in the bottom-right corner.
 * Accounts for ~14 chars at font size 12 with mixed weights, plus a gap
 * so adjacent text doesn't crowd it. Used by chrome and legend layout to avoid
 * overlapping the brand.
 */
export const BRAND_RESERVE_WIDTH = 130;

/** Font size of the brand watermark (px). Shared between layout and renderer. */
export const BRAND_FONT_SIZE = 12;

/** Minimum chart width to render the brand watermark (px). */
export const BRAND_MIN_WIDTH = 120;

/**
 * Estimate the rendered height of a text block.
 *
 * @param fontSize - Font size in pixels.
 * @param lineCount - Number of lines. Defaults to 1.
 * @param lineHeight - Line height multiplier. Defaults to 1.3.
 */
export function estimateTextHeight(fontSize: number, lineCount = 1, lineHeight = 1.3): number {
  return fontSize * lineHeight * lineCount;
}
