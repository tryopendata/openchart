import type { RectMark } from '@opendata-ai/openchart-core';
import { buildD3Formatter } from '@opendata-ai/openchart-core';
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

    const labels = computeBarLabels(thousandMarks, chartArea, 'all', buildD3Formatter('$~s'));
    expect(labels).toHaveLength(3);
    expect(labels[0].text).toBe('$6k');
    expect(labels[1].text).toBe('$7k');
    expect(labels[2].text).toBe('$14k');
  });

  it('$~s format works for millions', () => {
    const millionMarks: RectMark[] = [makeAbbreviatedMark(0, 1500000, '1.5M')];

    const labels = computeBarLabels(millionMarks, chartArea, 'all', buildD3Formatter('$~s'));
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('$1.5M');
  });

  it('handles comma-formatted aria values', () => {
    const commaMarks: RectMark[] = [makeAbbreviatedMark(0, 500, '500')];

    const labels = computeBarLabels(commaMarks, chartArea, 'all', buildD3Formatter('$,.0f'));
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

    const labels = computeBarLabels(unicodeMarks, chartArea, 'all', buildD3Formatter('+.0f%'));
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('\u221234%'); // −34%
    expect(labels[1].text).toBe('\u22125%'); // −5%
  });
});

// ---------------------------------------------------------------------------
// Dark-mode inside-label color
// ---------------------------------------------------------------------------

describe('computeBarLabels inside-label color by mode', () => {
  // Wide bar (>= 40px) so the label is placed inside and uses pickLabelColor.
  function makeFilledMark(fill: string): RectMark {
    return {
      type: 'rect',
      x: 0,
      y: 0,
      width: 200,
      height: 25,
      fill,
      data: { category: 'A', value: 100 },
      aria: { label: 'A: 100' },
    };
  }

  it('mid-tone fill gets white inside-label in light mode, dark in dark mode', () => {
    const slate = [makeFilledMark('#94a3b8')];
    const light = computeBarLabels(
      slate,
      chartArea,
      'all',
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
    const dark = computeBarLabels(
      slate,
      chartArea,
      'all',
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
    expect(light[0].style.fill).toBe('#ffffff');
    expect(dark[0].style.fill).toBe('#111111');
  });

  it('saturated fill keeps white inside-label in both modes', () => {
    const red = [makeFilledMark('#c0392b')];
    const light = computeBarLabels(
      red,
      chartArea,
      'all',
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
    const dark = computeBarLabels(
      red,
      chartArea,
      'all',
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
    expect(light[0].style.fill).toBe('#ffffff');
    expect(dark[0].style.fill).toBe('#ffffff');
  });
});

describe('computeBarLabels knockout halo', () => {
  it('opts inside-placed labels out of the halo', () => {
    // width 200 >= MIN_WIDTH_FOR_INSIDE_LABEL, so the label is drawn inside the
    // bar on its own fill, contrast-picked against it.
    const labels = computeBarLabels([makeMark(0, 40)], chartArea, 'all');
    expect(labels).toHaveLength(1);
    expect(labels[0].halo).toBe(false);
  });

  it('leaves the halo on for labels placed outside a narrow bar', () => {
    // width 25 < MIN_WIDTH_FOR_INSIDE_LABEL, so the label sits past the bar's
    // right edge, over the plot background.
    const labels = computeBarLabels([makeMark(0, 5)], chartArea, 'all');
    expect(labels).toHaveLength(1);
    expect(labels[0].halo).not.toBe(false);
  });
});

describe('explicit bar label placement', () => {
  const options = (placement: 'inside' | 'outside' | 'column') => ({
    placement,
    measureText: () => ({ width: 80, height: 14 }),
    columnWidth: 80,
  });
  it('inside hides text that cannot fit a bar even when above the adaptive threshold', () => {
    const mark = makeMark(0, 10); // 50px wide, too short for 80px text
    const label = computeBarLabels(
      [mark],
      chartArea,
      'all',
      null,
      undefined,
      'value',
      undefined,
      false,
      undefined,
      undefined,
      'Georgia',
      options('inside'),
    )[0];
    expect(label.visible).toBe(false);
  });
  it('outside follows the raw signed value, including format strings without a minus', () => {
    const signed = [makeMark(0, -10), makeMark(1, 0), makeMark(2, 20)];
    const labels = computeBarLabels(
      signed,
      chartArea,
      'all',
      () => 'ten',
      undefined,
      'value',
      undefined,
      false,
      undefined,
      undefined,
      'Georgia',
      options('outside'),
    );
    expect(labels[0].x).toBe(signed[0].x - 6);
    expect(labels[0].style.textAnchor).toBe('end');
    expect(labels[1].style.textAnchor).toBe('start');
    expect(labels[2].x).toBe(signed[2].x + signed[2].width + 6);
  });
  it('column aligns every signed value at the measured gutter edge', () => {
    const labels = computeBarLabels(
      [makeMark(0, -10), makeMark(1, 0), makeMark(2, 20)],
      chartArea,
      'all',
      null,
      undefined,
      'value',
      undefined,
      false,
      undefined,
      undefined,
      'Georgia',
      options('column'),
    );
    expect(labels.map((label) => label.x)).toEqual([492, 492, 492]);
    expect(labels.every((label) => label.style.textAnchor === 'end')).toBe(true);
  });
});

it('explicit adaptive preserves omitted placement geometry', () => {
  const input = [makeMark(0, -10), makeMark(1, 0), makeMark(2, 20)];
  const omitted = computeBarLabels(input, chartArea, 'all', null, undefined, 'value');
  const adaptive = computeBarLabels(
    input,
    chartArea,
    'all',
    null,
    undefined,
    'value',
    undefined,
    false,
    undefined,
    undefined,
    undefined,
    { placement: 'adaptive' },
  );
  expect(adaptive).toEqual(omitted);
});

it('adaptive measures large text before choosing an inside anchor', () => {
  const mark = makeMark(0, 10);
  const label = computeBarLabels(
    [mark],
    chartArea,
    'all',
    () => '350M',
    undefined,
    'value',
    undefined,
    false,
    26,
  )[0];
  expect(label.style.textAnchor).toBe('start');
  expect(label.x).toBe(mark.x + mark.width + 6);
  expect(label.visible).toBe(true);
});

it('adaptive suppresses a label when neither inside nor its outside endpoint can fit', () => {
  const mark = makeMark(0, 80);
  const label = computeBarLabels(
    [mark],
    chartArea,
    'all',
    () => 'An exceptionally long value that cannot fit into this chart',
    undefined,
    'value',
    undefined,
    false,
    26,
  )[0];
  expect(label.visible).toBe(false);
});
