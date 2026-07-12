/**
 * Inline rich text for annotation labels: `**bold**` spans inside an otherwise
 * regular-weight sentence. This is the NYT/Datawrapper voice — emphasis lands on
 * the key phrase, not on the whole block.
 */

/** One run of annotation text at a single weight. */
export interface RichSpan {
  text: string;
  bold: boolean;
}

/** Weight bold spans are measured and rendered at. */
export const BOLD_SPAN_FONT_WEIGHT = 700;

const BOLD_DELIMITER = '**';

/**
 * Parse `**bold**` markers in a single line of annotation text.
 *
 * Only matched pairs turn bold; an unmatched `**` renders literally, so specs
 * that legitimately contain asterisks are never mangled. Empty `****` also
 * renders literally (there's nothing to emphasize).
 *
 * The line is expected to be a single line — callers split on `\n` first.
 */
export function parseAnnotationSpans(line: string): RichSpan[] {
  if (!line.includes(BOLD_DELIMITER)) {
    return [{ text: line, bold: false }];
  }

  const spans: RichSpan[] = [];
  let plain = '';
  let i = 0;

  const flushPlain = (): void => {
    if (plain) {
      spans.push({ text: plain, bold: false });
      plain = '';
    }
  };

  while (i < line.length) {
    if (line.startsWith(BOLD_DELIMITER, i)) {
      const close = line.indexOf(BOLD_DELIMITER, i + BOLD_DELIMITER.length);
      const inner = close === -1 ? '' : line.slice(i + BOLD_DELIMITER.length, close);
      if (close === -1 || inner.length === 0) {
        // Unmatched (or empty) delimiter: render it literally.
        plain += BOLD_DELIMITER;
        i += BOLD_DELIMITER.length;
        continue;
      }
      flushPlain();
      spans.push({ text: inner, bold: true });
      i = close + BOLD_DELIMITER.length;
      continue;
    }
    plain += line[i];
    i++;
  }

  flushPlain();

  return spans.length > 0 ? spans : [{ text: '', bold: false }];
}
