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
const AVG_CHAR_WIDTH_RATIO = 0.55;

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
  const weightFactor = WEIGHT_ADJUSTMENT[fontWeight] ?? 1.0;
  return text.length * fontSize * AVG_CHAR_WIDTH_RATIO * weightFactor;
}

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
