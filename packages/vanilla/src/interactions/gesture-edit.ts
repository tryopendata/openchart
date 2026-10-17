/** Internal gesture descriptions; public edits are atomic EditTransactions. */
import type {
  AnnotationOffset,
  ChromeKey,
  ElementRef,
  RangeAnnotation,
  RefLineAnnotation,
  TextAnnotation,
} from '@opendata-ai/openchart-core';

export type GestureEdit =
  | {
      type: 'annotation';
      element: ElementRef;
      annotation: TextAnnotation;
      offset: AnnotationOffset;
      /** Resolved first-drag placement. Persist together with offset when supplied. */
      anchor?: TextAnnotation['anchor'];
      /** A moved annotation stays inline. */
      responsive?: false;
    }
  | {
      type: 'annotation-connector';
      element: ElementRef;
      annotation: TextAnnotation;
      endpoint: 'from' | 'to';
      offset: AnnotationOffset;
    }
  | {
      type: 'range-label';
      element: ElementRef;
      annotation: RangeAnnotation;
      labelOffset: AnnotationOffset;
    }
  | {
      type: 'refline-label';
      element: ElementRef;
      annotation: RefLineAnnotation;
      labelOffset: AnnotationOffset;
    }
  | {
      type: 'annotation-anchor';
      element: ElementRef;
      annotation: TextAnnotation;
      x: string | number;
      y: string | number;
    }
  | { type: 'chrome'; key: ChromeKey; text: string; offset: AnnotationOffset }
  | { type: 'legend'; offset: AnnotationOffset }
  | { type: 'add'; annotation: TextAnnotation }
  | { type: 'delete'; element: ElementRef }
  | { type: 'text-edit'; element: ElementRef; oldText: string; newText: string };
