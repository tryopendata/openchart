import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { runAggregate } from '../aggregate';
import { runJoinAggregate } from '../joinaggregate';

describe('summaries preserve missing observations', () => {
  const data = [
    { group: 'A', value: 10 },
    { group: 'A', value: null },
    { group: 'A', value: '' },
    { group: 'A', value: false },
    { group: 'B', value: null },
  ];
  it('excludes missing values from mean/min and leaves all-missing groups unknown', () => {
    for (const op of ['sum', 'mean', 'median', 'min', 'max', 'q1', 'q3'] as const) {
      expect(
        runAggregate(data, {
          groupby: ['group'],
          aggregate: [{ op, field: 'value', as: 'result' }],
        }),
      ).toEqual([
        { group: 'A', result: 10 },
        { group: 'B', result: null },
      ]);
      expect(
        runJoinAggregate(data, {
          groupby: ['group'],
          joinaggregate: [{ op, field: 'value', as: 'result' }],
        }).map((row) => row.result),
      ).toEqual([10, 10, 10, 10, null]);
    }
    expect(
      runAggregate(data, {
        groupby: ['group'],
        aggregate: [{ op: 'count', field: 'value', as: 'count' }],
      }).map((row) => row.count),
    ).toEqual([4, 1]);
  });
  it('keeps distinct empty, missing, numeric and string groups, including delimiter characters', () => {
    const source = [null, '', 1, '1', 'a\0b'].map((group) => ({ group, value: 2 }));
    const aggregate = [{ op: 'sum' as const, field: 'value', as: 'result' }];
    expect(runAggregate(source, { groupby: ['group'], aggregate })).toHaveLength(5);
    expect(
      runJoinAggregate(source, { groupby: ['group'], joinaggregate: aggregate }).map(
        (row) => row.result,
      ),
    ).toEqual([2, 2, 2, 2, 2]);
  });
  it('compiles only measured marks and exposes the real summary to inspection', () => {
    const layout = compileChart(
      {
        mark: 'bar',
        data: data.filter((row) => typeof row.value !== 'boolean'),
        transform: [
          { aggregate: [{ op: 'mean', field: 'value', as: 'value' }], groupby: ['group'] },
        ],
        encoding: {
          x: { field: 'group', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      { width: 600, height: 400 },
    );
    const bars = layout.marks.filter((mark) => mark.type === 'rect');
    expect(bars).toHaveLength(1);
    expect(bars[0].data).toMatchObject({ group: 'A', value: 10 });
  });
});

it.each([
  'horizontal',
  'vertical',
] as const)('keeps normalized %s stacks within the plot when only one segment is measured', (orientation) => {
  const value = { field: 'value', type: 'quantitative' as const, stack: 'normalize' as const };
  const category = { field: 'group', type: 'nominal' as const };
  const layout = compileChart(
    {
      mark: 'bar',
      data: [
        { group: 'A', series: 'one', value: 50 },
        { group: 'A', series: 'two', value: null },
        { group: 'B', series: 'one', value: 60 },
        { group: 'B', series: 'two', value: null },
      ],
      encoding: {
        x: orientation === 'horizontal' ? value : category,
        y: orientation === 'horizontal' ? category : value,
        color: { field: 'series', type: 'nominal' },
      },
    },
    { width: 640, height: 400 },
  );
  const bars = layout.marks.filter((mark) => mark.type === 'rect');
  expect(bars).toHaveLength(2);
  for (const bar of bars) {
    expect(bar.width).toBeLessThanOrEqual(layout.area.width + 1);
    expect(bar.height).toBeLessThanOrEqual(layout.area.height + 1);
    expect(bar.data.value).toBeGreaterThan(0);
  }
});
