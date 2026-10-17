import type {
  Annotation,
  AnnotationFootnote,
  MeasureTextFn,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { parseAnnotationSpans } from './rich-text';
import { wrapAnnotationText } from './wrap-text';

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
  const measure = (text: string, style: { fontSize: number; fontWeight?: number | string }) =>
    measureText?.(text, style.fontSize, Number(style.fontWeight) || weight).width ??
    estimateTextWidth(text, style.fontSize, Number(style.fontWeight) || weight);
  return notes.map((note) => {
    const lines = wrapAnnotationText(
      `${note.index}. ${note.text}${note.subtitle ? `\n${note.subtitle}` : ''}`,
      maxWidth,
      { fontSize: size, fontWeight: weight },
      measure,
    );
    return { ...note, lines, spans: lines.map(parseAnnotationSpans) };
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
            text: annotation.text,
            subtitle: annotation.subtitle,
          },
        ]
      : [],
  );
  // Reserve the widest source ordinal so placement and drag changes cannot
  // change capacity, including with proportional numeral fonts.
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
