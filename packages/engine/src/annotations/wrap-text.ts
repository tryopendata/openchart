import type { AnnotationMeasureTextFn } from './geometry';
import { BOLD_SPAN_FONT_WEIGHT, parseAnnotationSpans } from './rich-text';

type Character = { text: string; bold: boolean };

/** Wrap display text without changing the authored string used for identity and notes. */
export function wrapAnnotationText(
  text: string,
  maxWidth: number,
  style: { fontSize: number; fontWeight?: number | string },
  measure: AnnotationMeasureTextFn,
): string[] {
  const width = (chars: Character[]) => {
    let total = 0;
    let run = '';
    let bold = false;
    const flush = () => {
      total += measure(run, {
        fontSize: style.fontSize,
        fontWeight: bold ? BOLD_SPAN_FONT_WEIGHT : Number(style.fontWeight) || 400,
      });
    };
    for (const char of chars) {
      if (char.bold !== bold) {
        flush();
        run = '';
        bold = char.bold;
      }
      run += char.text;
    }
    flush();
    return total;
  };
  const serialize = (chars: Character[]) => {
    let result = '';
    let bold = false;
    for (const char of chars) {
      if (char.bold !== bold) {
        result += '**';
        bold = char.bold;
      }
      result += char.text;
    }
    return result + (bold ? '**' : '');
  };
  return text.split('\n').flatMap((paragraph) => {
    const chars = parseAnnotationSpans(paragraph).flatMap((span) =>
      Array.from(span.text, (text) => ({ text, bold: span.bold })),
    );
    const lines: string[] = [];
    let pending: Character[] = [];
    for (const char of chars) {
      pending.push(char);
      if (width(pending) <= maxWidth || pending.length === 1) continue;
      let split = -1;
      for (let i = pending.length - 1; i > 0; i--)
        if (/\s/.test(pending[i].text)) {
          split = i;
          break;
        }
      if (split > 0) {
        lines.push(serialize(pending.slice(0, split)));
        pending = pending.slice(split + 1);
      } else {
        const last = pending.pop()!;
        lines.push(serialize(pending));
        pending = [last];
      }
    }
    if (pending.length || !lines.length) lines.push(serialize(pending));
    return lines;
  });
}
