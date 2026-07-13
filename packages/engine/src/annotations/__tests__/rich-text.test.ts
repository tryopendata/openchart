import { describe, expect, it } from 'vitest';
import { computeTextBlockBounds, heuristicMeasure } from '../geometry';
import { parseAnnotationSpans } from '../rich-text';

describe('parseAnnotationSpans', () => {
  it('returns a single regular span for plain text', () => {
    expect(parseAnnotationSpans('Inflation cooled')).toEqual([
      { text: 'Inflation cooled', bold: false },
    ]);
  });

  it('splits a single bold span out of the surrounding text', () => {
    expect(parseAnnotationSpans('Inflation peaked at **8.5%** in June')).toEqual([
      { text: 'Inflation peaked at ', bold: false },
      { text: '8.5%', bold: true },
      { text: ' in June', bold: false },
    ]);
  });

  it('handles multiple bold spans on one line', () => {
    expect(parseAnnotationSpans('In **California,** ballots arrive by **Nov. 20**')).toEqual([
      { text: 'In ', bold: false },
      { text: 'California,', bold: true },
      { text: ' ballots arrive by ', bold: false },
      { text: 'Nov. 20', bold: true },
    ]);
  });

  it('bolds a span at the start of the line', () => {
    expect(parseAnnotationSpans('**Feb. 25** peak')).toEqual([
      { text: 'Feb. 25', bold: true },
      { text: ' peak', bold: false },
    ]);
  });

  it('bolds a span at the end of the line', () => {
    expect(parseAnnotationSpans('Peak on **Feb. 25**')).toEqual([
      { text: 'Peak on ', bold: false },
      { text: 'Feb. 25', bold: true },
    ]);
  });

  it('renders an unmatched delimiter literally', () => {
    expect(parseAnnotationSpans('Up **50% since 2020')).toEqual([
      { text: 'Up **50% since 2020', bold: false },
    ]);
  });

  it('renders an empty delimiter pair literally', () => {
    expect(parseAnnotationSpans('Nothing **** here')).toEqual([
      { text: 'Nothing **** here', bold: false },
    ]);
  });

  it('never returns an empty span list', () => {
    expect(parseAnnotationSpans('')).toEqual([{ text: '', bold: false }]);
  });
});

describe('computeTextBlockBounds with rich text', () => {
  const style = {
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.3,
    textAnchor: 'start' as const,
  };

  it('measures a line with bold spans wider than the same line all-regular', () => {
    const bold = computeTextBlockBounds(0, 20, 'Inflation peaked at **8.5%**', style);
    const plain = computeTextBlockBounds(0, 20, 'Inflation peaked at 8.5%', style);

    expect(bold.width).toBeGreaterThan(plain.width);
  });

  it('does not count the ** markers in the measured width', () => {
    // The markers are syntax, not glyphs. A naive raw-string measure would make
    // the bold version wider by four asterisks at weight 400 — this asserts the
    // widening comes from the weight, not the delimiters.
    const withMarkers = computeTextBlockBounds(0, 20, '**8.5%**', style, heuristicMeasure);
    const boldOnly = heuristicMeasure('8.5%', { fontSize: 13, fontWeight: 700 });

    expect(withMarkers.width).toBeCloseTo(boldOnly, 5);
  });

  it('measures multi-line rich text by its widest line', () => {
    const bounds = computeTextBlockBounds(0, 20, 'short\n**a much longer bold line**', style);
    const longestAlone = computeTextBlockBounds(0, 20, '**a much longer bold line**', style);

    expect(bounds.width).toBeCloseTo(longestAlone.width, 5);
  });
});
