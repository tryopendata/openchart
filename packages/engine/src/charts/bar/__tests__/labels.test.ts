import type { RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computeBarLabels } from '../labels';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const chartArea = { x: 0, y: 0, width: 400, height: 300 };

function makeMark(index: number, value: number): RectMark {
  return {
    type: 'rect',
    x: 0,
    y: index * 30,
    width: Math.abs(value) * 5,
    height: 25,
    fill: '#4e79a7',
    data: { category: `Cat${index}`, value },
    aria: { label: `Cat${index}: ${value}` },
  };
}

const marks: RectMark[] = [
  makeMark(0, 10),
  makeMark(1, 20),
  makeMark(2, 30),
  makeMark(3, 40),
  makeMark(4, 50),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeBarLabels density modes', () => {
  it('density "auto" runs collision detection and produces labels', () => {
    const labels = computeBarLabels(marks, chartArea, 'auto');
    expect(labels.length).toBeGreaterThan(0);
    // Some labels may be hidden by collision detection
    expect(labels.every((l) => typeof l.visible === 'boolean')).toBe(true);
  });

  it('density "all" shows every label as visible', () => {
    const labels = computeBarLabels(marks, chartArea, 'all');
    expect(labels).toHaveLength(marks.length);
    expect(labels.every((l) => l.visible === true)).toBe(true);
  });

  it('density "none" returns empty array', () => {
    const labels = computeBarLabels(marks, chartArea, 'none');
    expect(labels).toHaveLength(0);
  });

  it('density "endpoints" returns only first and last labels', () => {
    const labels = computeBarLabels(marks, chartArea, 'endpoints');
    expect(labels).toHaveLength(2);
    // First label should contain the first mark's value
    expect(labels[0].text).toBe('10');
    // Last label should contain the last mark's value
    expect(labels[1].text).toBe('50');
  });

  it('density "endpoints" with single mark returns that mark', () => {
    const labels = computeBarLabels([marks[0]], chartArea, 'endpoints');
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('10');
  });

  it('default density is "auto"', () => {
    const withAuto = computeBarLabels(marks, chartArea, 'auto');
    const withDefault = computeBarLabels(marks, chartArea);
    expect(withDefault.length).toBe(withAuto.length);
  });
});

// ---------------------------------------------------------------------------
// Stacked bar segment-fit tests (BUG-4)
// ---------------------------------------------------------------------------

function makeStackedMark(index: number, value: number, width: number): RectMark {
  return {
    type: 'rect',
    x: index * 50,
    y: 0,
    width,
    height: 25,
    fill: '#4e79a7',
    cornerRadius: 0,
    stackGroup: `Cat${index}`,
    data: { category: `Cat${index}`, value },
    aria: { label: `Cat${index}: ${value}` },
  };
}

describe('stacked bar label segment-fit', () => {
  it('density "all" hides labels that do not fit in narrow stacked segments', () => {
    const stackedMarks: RectMark[] = [
      // Narrow segment: 30px wide, label for "8003" will be wider than 30 - 12 = 18px
      makeStackedMark(0, 8003, 30),
      // Wide segment: 200px wide, label should fit easily
      makeStackedMark(1, 5000, 200),
    ];
    const labels = computeBarLabels(stackedMarks, chartArea, 'all');
    expect(labels).toHaveLength(2);
    // Narrow segment label should be hidden
    expect(labels[0].visible).toBe(false);
    // Wide segment label should still be visible
    expect(labels[1].visible).toBe(true);
  });

  it('density "auto" hides labels that do not fit in narrow stacked segments', () => {
    const stackedMarks: RectMark[] = [makeStackedMark(0, 8003, 30), makeStackedMark(1, 5000, 200)];
    const labels = computeBarLabels(stackedMarks, chartArea, 'auto');
    expect(labels).toHaveLength(2);
    // Narrow segment label should be hidden
    expect(labels[0].visible).toBe(false);
    // Wide segment label should still be visible
    expect(labels[1].visible).toBe(true);
  });

  it('non-stacked bars still show labels regardless of width', () => {
    // Non-stacked marks have no stackGroup
    const nonStackedMarks: RectMark[] = [
      makeMark(0, 10), // width = 50
      makeMark(1, 20), // width = 100
    ];
    const labels = computeBarLabels(nonStackedMarks, chartArea, 'all');
    expect(labels).toHaveLength(2);
    expect(labels.every((l) => l.visible === true)).toBe(true);
  });

  it('wide stacked segments still show labels', () => {
    const wideStacked: RectMark[] = [makeStackedMark(0, 42, 200), makeStackedMark(1, 99, 200)];
    const labels = computeBarLabels(wideStacked, chartArea, 'all');
    expect(labels).toHaveLength(2);
    expect(labels.every((l) => l.visible === true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Format with abbreviated aria values (BUG-3)
// ---------------------------------------------------------------------------

describe('computeBarLabels with $~s format and abbreviated aria values', () => {
  function makeAbbreviatedMark(index: number, value: number, abbr: string): RectMark {
    return {
      type: 'rect',
      x: 0,
      y: index * 30,
      width: 200,
      height: 25,
      fill: '#4e79a7',
      data: { category: `Cat${index}`, value },
      aria: { label: `Cat${index}: ${abbr}` },
    };
  }

  it('$~s format preserves SI suffix for low thousands', () => {
    const thousandMarks: RectMark[] = [
      makeAbbreviatedMark(0, 6000, '6K'),
      makeAbbreviatedMark(1, 7000, '7K'),
      makeAbbreviatedMark(2, 14000, '14K'),
    ];

    const labels = computeBarLabels(thousandMarks, chartArea, 'all', '$~s');
    expect(labels).toHaveLength(3);
    expect(labels[0].text).toBe('$6k');
    expect(labels[1].text).toBe('$7k');
    expect(labels[2].text).toBe('$14k');
  });

  it('$~s format works for millions', () => {
    const millionMarks: RectMark[] = [makeAbbreviatedMark(0, 1500000, '1.5M')];

    const labels = computeBarLabels(millionMarks, chartArea, 'all', '$~s');
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('$1.5M');
  });

  it('handles comma-formatted aria values', () => {
    const commaMarks: RectMark[] = [makeAbbreviatedMark(0, 500, '500')];

    const labels = computeBarLabels(commaMarks, chartArea, 'all', '$,.0f');
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('$500');
  });
});

// ---------------------------------------------------------------------------
// Unicode minus sign handling
// ---------------------------------------------------------------------------

describe('computeBarLabels with Unicode minus (U+2212) in aria values', () => {
  function makeUnicodeMinusMark(index: number, ariaValue: string): RectMark {
    return {
      type: 'rect',
      x: 0,
      y: index * 30,
      width: 200,
      height: 25,
      fill: '#4e79a7',
      data: { category: `Cat${index}` },
      aria: { label: `Cat${index}: ${ariaValue}` },
    };
  }

  it('parses Unicode minus and applies format with % suffix', () => {
    const unicodeMarks: RectMark[] = [
      makeUnicodeMinusMark(0, '\u221234'), // −34
      makeUnicodeMinusMark(1, '\u22125'), // −5
    ];

    const labels = computeBarLabels(unicodeMarks, chartArea, 'all', '+.0f%');
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('\u221234%'); // −34%
    expect(labels[1].text).toBe('\u22125%'); // −5%
  });
});
