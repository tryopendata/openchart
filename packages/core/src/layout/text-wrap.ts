/**
 * Word-wrap a text string into lines that fit within a max width.
 *
 * Shared by the SVG chart renderer and the sankey renderer. When a
 * `measureText` callback is provided, uses real DOM measurement for
 * accurate wrapping. Otherwise falls back to a character-width
 * heuristic driven by `estimateCharWidth` from text-measure.ts.
 *
 * Callers that want heuristic-only behavior (e.g. sankey) should omit
 * the measureText argument. Do not change the signature without
 * re-verifying visual baselines for every caller.
 */

import type { MeasureTextFn } from '../types/layout';
import { estimateCharWidth } from './text-measure';

/**
 * Break text into lines that fit within maxWidth using word wrapping.
 *
 * Splits on explicit newlines first, then word-wraps each segment.
 * Preserves empty segments so consecutive newlines produce blank lines.
 *
 * @param text - The text to wrap. May contain `\n` for forced breaks.
 * @param fontSize - Font size in pixels.
 * @param fontWeight - Font weight (100-900).
 * @param maxWidth - Maximum line width in pixels. Non-positive values return `[text]` unchanged.
 * @param measureText - Optional real text measurer. When omitted, uses a character-width heuristic.
 */
export function wrapText(
  text: string,
  fontSize: number,
  fontWeight: number,
  maxWidth: number,
  measureText?: MeasureTextFn,
): string[] {
  if (maxWidth <= 0) return [text];

  // Split on explicit newlines first
  const segments = text.split('\n');
  if (segments.length > 1) {
    return segments.flatMap((segment) =>
      segment.length === 0 ? [''] : wrapText(segment, fontSize, fontWeight, maxWidth, measureText),
    );
  }

  // Use real text measurement when available
  if (measureText) {
    const textWidth = measureText(text, fontSize, fontWeight).width;
    if (textWidth <= maxWidth) return [text];

    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const candidateWidth = measureText(candidate, fontSize, fontWeight).width;
      if (candidateWidth > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);

    return lines;
  }

  // Heuristic: estimate character width from font size and weight.
  // Reuses the same ratio and weight adjustment constants as text-measure.
  const charWidth = estimateCharWidth(fontSize, fontWeight);
  const maxChars = Math.floor(maxWidth / charWidth);

  if (text.length <= maxChars) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}
