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
  it('pools content within the table body from geometry alone as rows cross', () => {
    const { layout, geometry } = tableAt(3.37, 360);
    const { bodyHeight, rowHeight, fontSize, headerHeight } = layout.static;
    expect(bodyHeight).toBeCloseTo(layout.area.height - headerHeight);
    expect(geometry.rows.some(({ contentOffset }) => Math.abs(contentOffset) > 1)).toBe(true);
    const paintHeight = Math.max(0, rowHeight - 1);
    const textHeight = Math.min(paintHeight, fontSize * 1.2);
    for (const row of geometry.rows.filter(({ atEdge }) => !atEdge)) {
      const top = row.y + row.contentOffset + (paintHeight - textHeight) / 2;
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top + textHeight).toBeLessThanOrEqual(bodyHeight);
    }
    expect(tableAt(3.37, 360).geometry).toEqual(geometry);
  });

  it('gives the bottom slot to one row as entrants and exits slide past the table edge', () => {
    const { layout } = tableAt(0);
    const { headerHeight, rowHeight } = layout.static;
    expect(headerHeight).toBeGreaterThan(0);
    expect(headerHeight + 2 * rowHeight).toBeCloseTo(layout.area.height);

    const edgeRows = (t: number) => tableAt(t).geometry.rows.filter(({ y }) => y > rowHeight);
    const exit = edgeRows(3.72);
    const entry = edgeRows(3.9);
    expect(exit).toMatchObject([{ key: 'Alpine', atEdge: true }]);
    expect(entry).toMatchObject([{ key: 'Cedar', atEdge: true }]);
    for (const [row] of [exit, entry]) {
      expect(row.y + rowHeight).toBeGreaterThan(2 * rowHeight);
      expect(row.opacity).toBeGreaterThan(0);
      expect(row.opacity).toBeLessThan(1);
    }
    for (let tick = 360; tick <= 390; tick++)
      expect(edgeRows(tick / 100).length).toBeLessThanOrEqual(1);
  });

  it('shows the interpolated rank as soon as values cross and waits for the movement to settle', () => {
    const before = [
      { column: 'rank', text: '2' },
      { column: 'change', direction: 'same', text: '' },
    ];
    expect(raceFrameAt(model, 3.2).items.find(({ key }) => key === 'Brook')?.rank).toBe(1);
    expect(raceFrameAt(model, 3.8).items.find(({ key }) => key === 'Brook')?.rank).toBe(0);
    expect(rankCells(3.2, 'Brook')).toEqual(before);
    expect(rankCells(3.37, 'Brook')).toEqual([
      { column: 'rank', text: '1' },
      { column: 'change', direction: 'same', text: '' },
    ]);
    expect(rankCells(3.8, 'Brook')).toEqual([
      { column: 'rank', text: '1' },
      { column: 'change', direction: 'up', text: '↑1' },
    ]);
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

  it('shows unique ranks in displayed value order and reports the exact previous period change', () => {
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
    const standings = geometry.rows.map(({ key, cells }) => ({
      key,
      rank: 'text' in cells[0] ? Number(cells[0].text) : NaN,
      value: 'text' in cells[4] ? Number(cells[4].text) : NaN,
    }));
    expect(standings.sort((a, b) => b.value - a.value)).toEqual([
      { key: 'Alpine', rank: 1, value: 95 },
      { key: 'Brook', rank: 2, value: 94 },
      { key: 'Cedar', rank: 3, value: 92 },
    ]);
    const next = raceGeometryAt(close, layout, 2);
    if (next.mark !== 'table') throw new Error('Expected a table');
    expect(next.rows.find(({ key }) => key === 'Alpine')?.cells.slice(0, 2)).toEqual([
      { column: 'rank', text: '3' },
      { column: 'change', direction: 'down', text: '↓2' },
    ]);
  });

  it('uses the exact timeline order for tied interpolated values', () => {
    const tied = 3 + 50 / 140;
    const frame = raceFrameAt(model, tied);
    const geometry = tableAt(tied).geometry;
    const leaders = frame.items.filter(({ rank }) => rank < 2).sort((a, b) => a.rank - b.rank);
    expect(geometry.rows).toHaveLength(2);
    expect(leaders.map(({ key }) => rankCells(tied, key)?.[0])).toEqual([
      { column: 'rank', text: '1' },
      { column: 'rank', text: '2' },
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
    expect(rankCells(t, 'Brook')?.[1]).toEqual({ column: 'change', direction: 'same', text: '' });
  });

  it('scales fixed inline bars to the race maximum and shares to the whole period', () => {
    const { layout, geometry } = tableAt(0);
    const width = layout.static.columns.find(({ column }) => column === 'bar')?.width ?? 0;
    expect(width).toBeGreaterThan(0);
    expect(geometry.rows[0].cells[3]).toMatchObject({ width: width * (100 / 120) });
    expect(geometry.rows).toMatchObject([
      {
        key: 'Alpine',
        cells: [
          { column: 'rank', text: '1' },
          { column: 'change', direction: 'same', text: '' },
          { column: 'name', text: 'Alpine', color: layout.colors[0] },
          { column: 'bar', x: 0, width: width * (100 / 120), color: layout.colors[0] },
          { column: 'value', text: '100.0' },
          { column: 'share', text: '76.9%' },
        ],
      },
      {
        key: 'Brook',
        cells: [
          { column: 'rank', text: '2' },
          { column: 'change', direction: 'same', text: '' },
          { column: 'name', text: 'Brook', color: layout.colors[1] },
          { column: 'bar', x: 0, width: width * (20 / 120), color: layout.colors[1] },
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

  it.each([
    { rescale: undefined, ratio: 1 },
    { rescale: { min: 150 }, ratio: 100 / 150 },
  ])('honors the frame domain for rescale $rescale', ({ rescale, ratio }) => {
    const scaled = prepareRace({ ...spec, race: { ...spec.race, rescale } }, {});
    const layout = layoutRace(scaled, { width: 800, height: 300 });
    const geometry = raceGeometryAt(scaled, layout, 0);
    if (layout.mark !== 'table' || geometry.mark !== 'table') throw new Error('Expected a table');
    const width = layout.static.columns.find(({ column }) => column === 'bar')?.width ?? 0;
    expect(width).toBeGreaterThan(0);
    expect(geometry.rows[0].cells[3]).toMatchObject({ x: 0, width: width * ratio });
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

  it('orders all visible shares by the interpolated values and includes hidden keys in the total', () => {
    const { geometry } = tableAt(3.5);
    const ranked = [...geometry.rows].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    expect(ranked.map(({ key, cells }) => [key, ...cells.slice(-2)])).toEqual([
      ['Brook', { column: 'value', text: '85.0' }, { column: 'share', text: '46.8%' }],
      ['Alpine', { column: 'value', text: '65.0' }, { column: 'share', text: '35.8%' }],
    ]);
    expect(
      tableAt(4)
        .geometry.rows.find(({ key }) => key === 'Brook')
        ?.cells.slice(-2),
    ).toEqual([
      { column: 'value', text: '120.0' },
      { column: 'share', text: '60.0%' },
    ]);
  });

  it('uses only the keys present at the playhead when calculating a share', () => {
    const gapped = prepareRace(
      {
        ...spec,
        data: [
          { period: 0, key: 'Alpine', score: 60 },
          { period: 0, key: 'Brook', score: 40 },
          { period: 1, key: 'Alpine', score: 80 },
          { period: 1, key: 'Cedar', score: 20 },
        ],
        mark: { type: 'table', columns: ['value', 'share'] },
        race: { ...spec.race, gaps: 'drop', top: 1 },
      },
      {},
    );
    const layout = layoutRace(gapped, { width: 360, height: 300 });
    const geometry = raceGeometryAt(gapped, layout, 0.5);
    if (layout.mark !== 'table' || geometry.mark !== 'table') throw new Error('Expected a table');
    expect(geometry.rows.map(({ key, cells }) => [key, ...cells])).toEqual([
      ['Alpine', { column: 'value', text: '70.0' }, { column: 'share', text: '100.0%' }],
    ]);
    expect(layout.static.columns[1].width).toBeGreaterThanOrEqual(
      estimateTextWidth('100.0%', layout.static.fontSize) + 2 * layout.static.cellPadding,
    );
  });

  it('displays shares when the whole-field total overflows between periods', () => {
    const large = prepareRace(
      {
        ...spec,
        data: [
          [1.2e308, 8e307],
          [8e307, 1.2e308],
        ].flatMap((scores, period) =>
          ['Alpine', 'Brook'].map((key, index) => ({ period, key, score: scores[index] })),
        ),
        mark: { type: 'table', columns: ['name', 'share'] },
      },
      {},
    );
    const layout = layoutRace(large, { width: 360, height: 300 });
    const start = raceGeometryAt(large, layout, 0);
    const middle = raceGeometryAt(large, layout, 0.5);
    if (start.mark !== 'table' || middle.mark !== 'table') throw new Error('Expected a table');
    expect(start.rows.map(({ cells }) => cells[1])).toEqual([
      { column: 'share', text: '60.0%' },
      { column: 'share', text: '40.0%' },
    ]);
    expect(middle.rows.map(({ cells }) => cells[1])).toEqual([
      { column: 'share', text: '50.0%' },
      { column: 'share', text: '50.0%' },
    ]);
  });

  it.each([
    { start: 20e12, end: 10e12, format: '$.3~s', t: 0.25, label: '$17.5T' },
    { start: 100, end: 200, format: undefined, t: 0.175, label: '117.50' },
  ])('reserves room for the interpolated value $label', ({ start, end, format, t, label }) => {
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
    const { fontSize, columns, cellPadding } = layout.static;
    const widest = Math.max(
      ...Array.from('0123456789', (digit) =>
        estimateTextWidth(label.replace(/\d/g, digit), fontSize),
      ),
    );
    expect(columns.find(({ column }) => column === 'value')?.width).toBeGreaterThanOrEqual(
      widest + 2 * cellPadding,
    );
  });

  it('suppresses shares for every row when a negative key is outside the visible ranking', () => {
    const shares = prepareRace(
      {
        ...spec,
        data: [
          { period: 0, key: 'Alpine', score: 100000 },
          { period: 0, key: 'Brook', score: -99999 },
          { period: 1, key: 'Alpine', score: 3 },
          { period: 1, key: 'Brook', score: 1 },
        ],
        race: { ...spec.race, top: 1 },
      },
      {},
    );
    const layout = layoutRace(shares, { width: 800, height: 300 });
    const geometry = raceGeometryAt(shares, layout, 0);
    if (layout.mark !== 'table' || geometry.mark !== 'table') throw new Error('Expected a table');
    const share = geometry.rows[0].cells[5];
    if (share.column !== 'share') throw new Error('Expected a share cell');
    expect(share.text).toBe('—');
    const next = raceGeometryAt(shares, layout, 1);
    if (next.mark !== 'table') throw new Error('Expected a table');
    expect(next.rows[0].cells[5]).toEqual({ column: 'share', text: '75.0%' });
  });

  it('waits for an extreme signed value to become nonnegative before displaying shares', () => {
    const signed = prepareRace(
      {
        ...spec,
        data: [0, 1].flatMap((period) => [
          { period, key: 'Gain', score: 100 },
          { period, key: 'Signed', score: period === 0 ? -1e308 : 1e308 },
        ]),
        mark: { type: 'table', columns: ['share'] },
        race: { ...spec.race, swap: 0 },
      },
      {},
    );
    const layout = layoutRace(signed, { width: 360, height: 300 });
    const shares = (t: number) => {
      const geometry = raceGeometryAt(signed, layout, t);
      if (geometry.mark !== 'table') throw new Error('Expected a table');
      return Object.fromEntries(geometry.rows.map(({ key, cells }) => [key, cells[0]]));
    };
    expect(shares(0.25)).toEqual({
      Gain: { column: 'share', text: '—' },
      Signed: { column: 'share', text: '—' },
    });
    expect(shares(0.75)).toEqual({
      Gain: { column: 'share', text: '0.0%' },
      Signed: { column: 'share', text: '100.0%' },
    });
  });

  it('reuses formatted value text across resize and theme changes for the same model', () => {
    let formatCalls = 0;
    const counted = {
      ...model,
      formatValue(value: number) {
        formatCalls++;
        return model.formatValue(value);
      },
    };
    const first = layoutRace(counted, { width: 800, height: 300 });
    expect(formatCalls).toBeGreaterThan(0);
    const firstCalls = formatCalls;
    const resized = layoutRace(counted, { width: 360, height: 300 });
    const themed = layoutRace(counted, {
      width: 360,
      height: 300,
      theme: { fonts: { sizes: { body: 18 } } },
    });
    expect(formatCalls).toBe(firstCalls);
    if (first.mark !== 'table' || resized.mark !== 'table' || themed.mark !== 'table')
      throw new Error('Expected a table');
    expect(themed.static.columns.find(({ column }) => column === 'value')?.width).toBeGreaterThan(
      resized.static.columns.find(({ column }) => column === 'value')?.width ?? Infinity,
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
