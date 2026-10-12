import { describe, expect, it } from 'vitest';
import { compileBarList } from '../barlist/compile-barlist';
import { compileChart } from '../compile';

const options = { width: 640, height: 400, onWarn: () => {} };
const missingValues = [null, undefined, '', '  ', false, true, NaN, Infinity, -Infinity, 'bad'];
const rows = [
  { label: 'zero', value: 0, end: 10 },
  { label: 'measured', value: ' 20 ', end: 30 },
  ...missingValues.map((value, index) => ({ label: `missing-${index}`, value, end: 10 })),
];

describe('measured numeric data across chart families', () => {
  it.each([
    'circle',
    'arc',
    'range',
    'beeswarm',
    'waffle',
    'parliament',
  ])('%s does not fabricate a zero observation from missing data', (mark) => {
    const encoding = ['arc', 'waffle', 'parliament'].includes(mark)
      ? {
          theta: { field: 'value', type: 'quantitative' },
          color: { field: 'label', type: 'nominal' },
        }
      : {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'label', type: 'nominal' },
          ...(mark === 'range' ? { x2: { field: 'end' } } : {}),
        };
    const layout = compileChart({ mark, data: rows, encoding }, options);
    const dataMarks = layout.marks.filter(
      (item) => !item.aria.decorative && !Array.isArray(item.data),
    );
    expect(dataMarks.length).toBeGreaterThan(0);
    expect(new Set(dataMarks.map((item) => (item.data as Record<string, unknown>).label))).toEqual(
      new Set(['arc', 'waffle', 'parliament'].includes(mark) ? ['measured'] : ['zero', 'measured']),
    );
    expect(JSON.stringify(dataMarks)).not.toMatch(/NaN|Infinity/);
  });

  it('requires both measured interval endpoints', () => {
    const layout = compileChart(
      {
        mark: 'range',
        data: rows.map((row) => ({ ...row, value: row.end, end: row.value })),
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          x2: { field: 'end' },
          y: { field: 'label', type: 'nominal' },
        },
      },
      options,
    );
    expect(
      new Set(layout.marks.map((mark) => (mark.data as Record<string, unknown>).label)),
    ).toEqual(new Set(['zero', 'measured']));
  });

  it('keeps calendar holes empty while showing measured zero days', () => {
    const layout = compileChart(
      {
        mark: 'calendar',
        data: rows.map((row, index) => ({
          ...row,
          date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        })),
        encoding: {
          x: { field: 'date', type: 'temporal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      options,
    );
    const cells = layout.marks.filter((mark) => mark.type === 'rect' && !mark.aria.decorative);
    expect(cells).toHaveLength(2);
    expect(cells.map((mark) => (mark.data as Record<string, unknown>).value)).toEqual([0, ' 20 ']);
  });

  it('keeps barlist blanks out of ranking and proportions', () => {
    const layout = compileBarList(
      {
        type: 'barlist',
        data: rows,
        encoding: {
          label: { field: 'label', type: 'nominal' },
          value: { field: 'value', type: 'quantitative' },
        },
      },
      options,
    );
    expect(layout.rows.map((row) => row.label.text)).toEqual(['measured', 'zero']);
    expect(JSON.stringify(layout.rows)).not.toMatch(/NaN|Infinity/);
  });

  it('counts only measured observations in histogram bins', () => {
    const layout = compileChart(
      {
        mark: 'bar',
        data: rows,
        encoding: {
          x: { field: 'value', type: 'quantitative', bin: true },
          y: { aggregate: 'count' },
        },
      },
      options,
    );
    const bars = layout.marks.filter((mark) => mark.type === 'rect');
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.aria.label)).toEqual(
      expect.arrayContaining([expect.stringMatching(/: 1$/), expect.stringMatching(/: 1$/)]),
    );
  });

  it('requires measured bounds and counts for authored histogram bins', () => {
    const data = [
      { start: 0, end: 10, count: 2 },
      ...missingValues.flatMap((value) => [
        { start: value, end: 10, count: 2 },
        { start: 0, end: value, count: 2 },
        { start: 0, end: 10, count: value },
      ]),
    ];
    const layout = compileChart(
      {
        mark: 'bar',
        data,
        encoding: {
          x: { field: 'start', type: 'quantitative' },
          x2: { field: 'end' },
          y: { field: 'count', type: 'quantitative' },
        },
      },
      options,
    );
    const bars = layout.marks.filter((mark) => mark.type === 'rect');
    expect(bars).toHaveLength(1);
    expect(bars[0].data).toEqual({ start: 0, end: 10, count: 2 });
  });
});

it('leaves heatmap cells empty when their quantitative color is unmeasured', () => {
  const layout = compileChart(
    {
      mark: 'rect',
      data: rows,
      encoding: {
        x: { field: 'label', type: 'nominal' },
        y: { field: 'end', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    options,
  );
  expect(layout.marks.map((mark) => (mark.data as Record<string, unknown>).value)).toEqual([
    0,
    ' 20 ',
  ]);
});
