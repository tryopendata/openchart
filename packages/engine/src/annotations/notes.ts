import type { AnnotationFootnote, MeasureTextFn, ResolvedTheme } from '@opendata-ai/openchart-core';
import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';

/** Resolve note lines once, so figure sizing, SVG rendering and export agree. */
export function wrapAnnotationNotes(
  notes: AnnotationFootnote[],
  width: number,
  theme: ResolvedTheme,
  measureText?: MeasureTextFn,
): AnnotationFootnote[] {
  const size = theme.fonts.sizes.small;
  const weight = theme.fonts.weights.normal;
  const maxWidth = Math.max(1, width - 2 * theme.spacing.padding);
  const measure = (text: string) =>
    measureText?.(text, size, weight).width ?? estimateTextWidth(text, size, weight);
  return notes.map((note) => {
    const text = `${note.index}. ${note.text}`;
    const lines = wrapText(text, size, weight, maxWidth, measureText).flatMap((line) => {
      // Word wrapping alone cannot contain an unbroken URL or identifier.
      const chunks: string[] = [];
      let chunk = '';
      for (const character of line) {
        if (chunk && measure(chunk + character) > maxWidth) {
          chunks.push(chunk);
          chunk = character;
        } else chunk += character;
      }
      chunks.push(chunk);
      return chunks;
    });
    return lines.length > 1 ? { ...note, lines } : note;
  });
}

export function annotationNoteLineCount(notes: AnnotationFootnote[]): number {
  return notes.reduce((count, note) => count + (note.lines?.length ?? 1), 0);
}
