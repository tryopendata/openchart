import type { MeasureTextFn, TextAnnotation } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { expect, it } from 'vitest';
import { annotationNoteCapacity, annotationNoteLineCount, wrapAnnotationNotes } from '../notes';

it('bounds note wrapping across numbering changes with proportional digits', () => {
  const theme = resolveTheme();
  const measureText: MeasureTextFn = (text) => ({
    width: [...text].reduce(
      (width, character) => width + (character === '8' ? 15 : character === '1' ? 1 : 5),
      0,
    ),
  });
  const annotations: TextAnnotation[] = Array.from({ length: 12 }, (_, index) => ({
    type: 'text',
    x: index,
    y: index,
    text: `Callout ${index}`,
    subtitle: 'Some explanatory context that may wrap',
  }));
  for (const width of [100, 150, 390]) {
    const capacity = annotationNoteCapacity(annotations, width, theme, measureText);
    for (let rotation = 0; rotation < annotations.length; rotation++) {
      const notes = annotations.map((annotation, index) => ({
        index: ((index + rotation) % annotations.length) + 1,
        text: `${annotation.text}. ${annotation.subtitle}`,
      }));
      expect(
        annotationNoteLineCount(wrapAnnotationNotes(notes, width, theme, measureText)),
      ).toBeLessThanOrEqual(capacity);
    }
  }
});
