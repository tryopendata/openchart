import type {
  Annotation,
  AnnotationFootnote,
  MeasureTextFn,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
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

/** Source capacity stays fixed when a drag pins a label or changes which notes demote. */
export function annotationNoteCapacity(
  annotations: Annotation[],
  width: number,
  theme: ResolvedTheme,
  measureText?: MeasureTextFn,
  includeSingle = false,
): number {
  if (annotations.length <= 1 && !includeSingle) return 0;
  const texts = annotations.flatMap((annotation, specIndex) =>
    annotation.type === 'text'
      ? [
          {
            specIndex,
            text: annotation.subtitle
              ? `${annotation.text}. ${annotation.subtitle}`
              : annotation.text,
          },
        ]
      : [],
  );
  // Priority and placement determine the eventual numbering. Budget every source
  // with the widest possible prefix, including proportional numeral fonts.
  const size = theme.fonts.sizes.small;
  const weight = theme.fonts.weights.normal;
  const measure = (text: string) =>
    measureText?.(text, size, weight).width ?? estimateTextWidth(text, size, weight);
  let widestIndex = 1;
  for (let index = 2; index <= texts.length; index++) {
    if (measure(`${index}. `) > measure(`${widestIndex}. `)) widestIndex = index;
  }
  return annotationNoteLineCount(
    wrapAnnotationNotes(
      texts.map((note) => ({ ...note, index: widestIndex })),
      width,
      theme,
      measureText,
    ),
  );
}
