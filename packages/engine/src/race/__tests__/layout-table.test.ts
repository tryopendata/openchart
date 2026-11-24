import { estimateTextWidth, type RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { layoutRace, prepareRace, raceFrameAt, raceGeometryAt } from '../../index';

const spec = {
  type: 'race',
  mark: 'table',
  data: [
    [100, 20, 10],
    [100, 30, 11],
    [100, 40, 12],
    [100, 50, 13],
    [30, 120, 50],
  ].flatMap((values, period) =>
    values.map((score, index) => ({ period, key: ['Alpine', 'Brook', 'Cedar'][index], score })),
  ),
  encoding: { time: { field: 'period' }, key: { field: 'key' }, value: { field: 'score' } },
  labels: { format: '.1f' },
  race: { top: 2, step: 1000, swap: 400, rescale: 'fixed' },
} satisfies RaceSpec;

const model = prepareRace(spec, {});

function tableAt(t: number, width = 800, mark?: Extract<RaceSpec['mark'], { type: 'table' }>) {
  const layout = layoutRace(model, { width, height: 300, mark });
  const geometry = raceGeometryAt(model, layout, t);
  if (layout.mark !== 'table' || geometry.mark !== 'table') throw new Error('Expected a table');
  return { layout, geometry };
}

function rankCells(t: number, key: string) {
  return tableAt(t)
    .geometry.rows.find((row) => row.key === key)
    ?.cells.slice(0, 2);
}

describe('race table layout', () => {
  it('reserves a header above the top slots and uses the fractional rank and opacity', () => {
    const t = 3.75;
    const { layout, geometry } = tableAt(t);
    const { headerHeight, rowHeight } = layout.static;
    expect(headerHeight).toBeGreaterThan(0);
    expect(headerHeight + 2 * rowHeight).toBeCloseTo(layout.area.height);

    const items = raceFrameAt(model, t).items;
    expect(items.some(({ rankPos }) => !Number.isInteger(rankPos))).toBe(true);
    expect(items.some(({ opacity }) => opacity < 1)).toBe(true);
    expect(geometry.rows.map(({ key }) => key).sort()).toEqual(items.map(({ key }) => key).sort());
    for (const item of items) {
      const row = geometry.rows.find(({ key }) => key === item.key);
      expect(row?.y).toBeCloseTo(item.rankPos * rowHeight);
      expect(row?.opacity).toBe(item.opacity);
    }
  });

  it('holds rank and change through an overtake and updates both at the period boundary', () => {
    const before = [
      { column: 'rank', text: '2' },
      { column: 'change', direction: 'same', text: '—' },
    ];
    expect(raceFrameAt(model, 3.2).items.find(({ key }) => key === 'Brook')?.rank).toBe(1);
    expect(raceFrameAt(model, 3.8).items.find(({ key }) => key === 'Brook')?.rank).toBe(0);
    expect(rankCells(3.2, 'Brook')).toEqual(before);
    expect(rankCells(3.8, 'Brook')).toEqual(before);
    expect(rankCells(4, 'Brook')).toEqual([
      { column: 'rank', text: '1' },
      { column: 'change', direction: 'up', text: '↑1' },
    ]);
  });

  it('marks a key entering the top N as new', () => {
    expect(rankCells(4, 'Cedar')).toEqual([
      { column: 'rank', text: '2' },
      { column: 'change', direction: 'new', text: 'new' },
    ]);
  });

  it('rounds the smoothed rank at the period itself and reports downward movement', () => {
    const close = prepareRace(
      {
        ...spec,
        data: [
          [100, 70, 50],
          [95, 94, 92],
          [30, 120, 125],
        ].flatMap((values, period) =>
          values.map((score, index) => ({
            period,
            key: ['Alpine', 'Brook', 'Cedar'][index],
            score,
          })),
        ),
        race: { ...spec.race, top: 3, swap: 600 },
      },
      {},
    );
    const layout = layoutRace(close, { width: 800, height: 300 });
    const geometry = raceGeometryAt(close, layout, 1);
    if (geometry.mark !== 'table') throw new Error('Expected a table');
    expect(raceFrameAt(close, 1).items.find(({ key }) => key === 'Alpine')?.rank).toBe(0);
    expect(geometry.rows.find(({ key }) => key === 'Alpine')?.cells.slice(0, 2)).toEqual([
      { column: 'rank', text: '2' },
      { column: 'change', direction: 'down', text: '↓1' },
    ]);
    const next = raceGeometryAt(close, layout, 2);
    if (next.mark !== 'table') throw new Error('Expected a table');
    expect(next.rows.find(({ key }) => key === 'Alpine')?.cells.slice(0, 2)).toEqual([
      { column: 'rank', text: '3' },
      { column: 'change', direction: 'down', text: '↓1' },
    ]);
  });

  it.each([
    { t: 3.28, risingRowIsHigher: false },
    { t: 3.4, risingRowIsHigher: true },
  ])('draws the rising row last during the crossing at $t', ({ t, risingRowIsHigher }) => {
    const { layout, geometry } = tableAt(t);
    const alpineIndex = geometry.rows.findIndex(({ key }) => key === 'Alpine');
    const brookIndex = geometry.rows.findIndex(({ key }) => key === 'Brook');
    expect(alpineIndex).toBeGreaterThanOrEqual(0);
    expect(brookIndex).toBeGreaterThan(alpineIndex);
    const offset = geometry.rows[brookIndex].y - geometry.rows[alpineIndex].y;
    expect(Math.abs(offset)).toBeLessThan(layout.static.rowHeight);
    expect(offset < 0).toBe(risingRowIsHigher);
    expect(rankCells(t, 'Brook')).toEqual(rankCells(3.2, 'Brook'));
  });

  it('scales inline bars to the current visible maximum and shares to the whole period', () => {
    const { layout, geometry } = tableAt(0);
    const width = layout.static.columns.find(({ column }) => column === 'bar')?.width ?? 0;
    expect(width).toBeGreaterThan(0);
    expect(geometry.rows).toMatchObject([
      {
        key: 'Alpine',
        cells: [
          { column: 'rank', text: '1' },
          { column: 'change', direction: 'same', text: '—' },
          { column: 'name', text: 'Alpine', color: layout.colors[0] },
          { column: 'bar', x: 0, width, color: layout.colors[0] },
          { column: 'value', text: '100.0' },
          { column: 'share', text: '76.9%' },
        ],
      },
      {
        key: 'Brook',
        cells: [
          { column: 'rank', text: '2' },
          { column: 'change', direction: 'same', text: '—' },
          { column: 'name', text: 'Brook', color: layout.colors[1] },
          { column: 'bar', x: 0, width: width * 0.2, color: layout.colors[1] },
          { column: 'value', text: '20.0' },
          { column: 'share', text: '15.4%' },
        ],
      },
    ]);
    expect(tableAt(4).geometry.rows.map(({ key, cells }) => ({ key, bar: cells[3] }))).toEqual([
      { key: 'Brook', bar: { column: 'bar', x: 0, width, color: layout.colors[1] } },
      {
        key: 'Cedar',
        bar: { column: 'bar', x: 0, width: width * (50 / 120), color: layout.colors[2] },
      },
    ]);
  });

  it('draws negatives to the left of zero and leaves shares blank when the total is zero', () => {
    const signed = prepareRace(
      {
        ...spec,
        data: [0, 1].flatMap((period) => [
          { period, key: 'Gain', score: 20 },
          { period, key: 'Loss', score: -20 },
        ]),
      },
      {},
    );
    const layout = layoutRace(signed, { width: 800, height: 300 });
    const geometry = raceGeometryAt(signed, layout, 0);
    if (layout.mark !== 'table' || geometry.mark !== 'table') throw new Error('Expected a table');
    const width = layout.static.columns.find(({ column }) => column === 'bar')?.width ?? 0;
    expect(width).toBeGreaterThan(0);
    expect(
      geometry.rows.map(({ cells }) =>
        cells.filter(({ column }) => ['bar', 'share'].includes(column)),
      ),
    ).toEqual([
      [
        { column: 'bar', x: width / 2, width: width / 2, color: layout.colors[0] },
        { column: 'share', text: '—' },
      ],
      [
        { column: 'bar', x: 0, width: width / 2, color: layout.colors[1] },
        { column: 'share', text: '—' },
      ],
    ]);
  });

  it('uses one period for both parts of the share while the visible value interpolates', () => {
    const cells = (t: number) =>
      tableAt(t)
        .geometry.rows.find(({ key }) => key === 'Brook')
        ?.cells.slice(-2);
    expect(cells(3.8)).toEqual([
      { column: 'value', text: '106.0' },
      { column: 'share', text: '30.7%' },
    ]);
    expect(cells(4)).toEqual([
      { column: 'value', text: '120.0' },
      { column: 'share', text: '60%' },
    ]);
  });

  it('displays the shares of finite values even when their total overflows', () => {
    const large = prepareRace(
      {
        ...spec,
        data: [0, 1].flatMap((period) =>
          ['Alpine', 'Brook'].map((key) => ({ period, key, score: 1e308 })),
        ),
        mark: { type: 'table', columns: ['name', 'share'] },
      },
      {},
    );
    const layout = layoutRace(large, { width: 360, height: 300 });
    const geometry = raceGeometryAt(large, layout, 0);
    if (geometry.mark !== 'table') throw new Error('Expected a table');
    expect(geometry.rows.map(({ cells }) => cells[1])).toEqual([
      { column: 'share', text: '50%' },
      { column: 'share', text: '50%' },
    ]);
  });

  it.each([
    { start: 20e12, end: 10e12, format: '$.3~s', t: 0.25, label: '$17.5T' },
    { start: 100, end: 200, format: undefined, t: 0.175, label: '117.50' },
  ])('reserves room for the interpolated tabular value $label', ({
    start,
    end,
    format,
    t,
    label,
  }) => {
    const scaled = prepareRace(
      {
        ...spec,
        data: [
          { period: 0, key: 'Alpine', score: start },
          { period: 1, key: 'Alpine', score: end },
        ],
        labels: format ? { format } : undefined,
        race: { ...spec.race, top: 1 },
      },
      {},
    );
    const layout = layoutRace(scaled, { width: 360, height: 300 });
    if (layout.mark !== 'table') throw new Error('Expected a table');
    expect(raceFrameAt(scaled, t).items[0].valueLabel).toBe(label);
    const { fontSize, columns } = layout.static;
    const widest = Math.max(
      ...Array.from('0123456789', (digit) =>
        estimateTextWidth(label.replace(/\d/g, digit), fontSize),
      ),
    );
    expect(columns.find(({ column }) => column === 'value')?.width).toBeGreaterThanOrEqual(
      widest + 10,
    );
  });

  it('sizes the share column from formatted percentages wider than the header', () => {
    const shares = prepareRace(
      {
        ...spec,
        data: [0, 1].flatMap((period) => [
          { period, key: 'Alpine', score: 100000 },
          { period, key: 'Brook', score: -99999 },
        ]),
      },
      {},
    );
    const layout = layoutRace(shares, { width: 800, height: 300 });
    const geometry = raceGeometryAt(shares, layout, 0);
    if (layout.mark !== 'table' || geometry.mark !== 'table') throw new Error('Expected a table');
    const share = geometry.rows[0].cells[5];
    if (share.column !== 'share') throw new Error('Expected a share cell');
    expect(share.text).toBe('10000000%');
    expect(layout.static.columns[5].width).toBeGreaterThan(
      estimateTextWidth(share.text, layout.static.fontSize) + 10,
    );
  });

  it('drops the default bar strictly below 520px of drawable width', () => {
    const padding = tableAt(0).layout.area.x;
    expect(tableAt(0, 519 + 2 * padding).layout.static.columns.map(({ column }) => column)).toEqual(
      ['rank', 'change', 'name', 'value', 'share'],
    );
    expect(tableAt(0, 520 + 2 * padding).layout.static.columns.map(({ column }) => column)).toEqual(
      ['rank', 'change', 'name', 'bar', 'value', 'share'],
    );
  });

  it('keeps the bar at a narrow width when it is the only requested column', () => {
    const { layout, geometry } = tableAt(0, 360, { type: 'table', columns: ['bar'] });
    expect(layout.static.columns).toEqual([
      { column: 'bar', x: layout.area.x, width: layout.area.width },
    ]);
    expect(geometry.rows.map(({ cells }) => cells.map(({ column }) => column))).toEqual([
      ['bar'],
      ['bar'],
    ]);
  });

  it('preserves custom column order in the layout and cells, including when a bar is dropped', () => {
    const mark = {
      type: 'table',
      columns: ['share', 'bar', 'name', 'rank'],
    } satisfies RaceSpec['mark'];
    for (const [width, columns] of [
      [800, ['share', 'bar', 'name', 'rank']],
      [360, ['share', 'name', 'rank']],
    ] as const) {
      const { layout, geometry } = tableAt(0, width, mark);
      expect(layout.static.columns.map(({ column }) => column)).toEqual(columns);
      expect(geometry.rows.map(({ cells }) => cells.map(({ column }) => column))).toEqual([
        columns,
        columns,
      ]);
    }
  });

  it.each(
    [330, 360, 680].flatMap((width) => [13, 16].map((body) => ({ width, body }))),
  )('fits measured columns into $width px with $body px body text', ({ width, body }) => {
    const layout = layoutRace(model, { width, height: 300, theme: { fonts: { sizes: { body } } } });
    if (layout.mark !== 'table') throw new Error('Expected a table');
    const { columns, fontSize, labels } = layout.static;
    expect(fontSize).toBe(body);
    let edge = layout.area.x;
    for (const column of columns) {
      expect(column.x).toBeCloseTo(edge);
      expect(column.width).toBeGreaterThan(estimateTextWidth(labels[column.column], body));
      edge += column.width;
    }
    expect(edge).toBeLessThanOrEqual(layout.area.x + layout.area.width + 0.001);
    const bar = columns.find(({ column }) => column === 'bar');
    if (bar) {
      const textWidth = columns.reduce(
        (sum, column) => sum + (column === bar ? 0 : column.width),
        0,
      );
      expect(bar.width).toBeCloseTo(layout.area.width - textWidth);
    }
  });
});
