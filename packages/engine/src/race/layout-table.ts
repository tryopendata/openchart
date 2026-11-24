import {
  formatPercent,
  type RaceTableCell,
  type RaceTableColumn,
} from '@opendata-ai/openchart-core';
import { interpolateRaceValue } from './interpolate';
import type { RaceMarkEntry } from './marks';
import type { RaceMatrix } from './types';

const DEFAULT_COLUMNS: RaceTableColumn[] = ['rank', 'change', 'name', 'bar', 'value', 'share'];
const LABELS: Record<RaceTableColumn, string> = {
  rank: 'Rank',
  change: 'Change',
  name: 'Name',
  bar: 'Bar',
  value: 'Value',
  share: 'Share',
};
const CELL_PADDING = 10;
const CHIP_WIDTH_AND_GAP = 14;
const EMPTY = '—';
// Quartiles alone can all land on whole numbers and miss the formatter's decimal digits.
const VALUE_WIDTH_SAMPLES = [0.25, 0.5, 0.75, Math.SQRT1_2];

function periodShareBase(values: RaceMatrix['values'], period: number) {
  let total = 0;
  let magnitude = 0;
  for (const series of values) {
    const value = series[period];
    if (!Number.isFinite(value)) continue;
    total += value;
    magnitude = Math.max(magnitude, Math.abs(value));
  }
  if (Number.isFinite(total)) return { total, scale: 1 };

  // Rescale both parts of the ratio when the unscaled sum overflows.
  total = 0;
  for (const series of values) {
    const value = series[period];
    if (Number.isFinite(value)) total += value / magnitude;
  }
  return { total, scale: magnitude };
}

function shareText(value: number, { total, scale }: ReturnType<typeof periodShareBase>): string {
  const share = value / scale / total;
  return Number.isFinite(share * 100) ? formatPercent(share) : EMPTY;
}

/** Measures `RaceTableMarkDef.columns` and drops `bar` below 520px unless it is the only column. */
export const computeTableStatic: RaceMarkEntry<'table'>['computeStatic'] = (
  model,
  { area, labels, theme },
  mark,
  measureText,
) => {
  const { body: fontSize } = theme.fonts.sizes;
  const { normal, semibold } = theme.fonts.weights;
  const { top, periodCount } = model.timeline;
  const measure = (text: string, weight = normal) => measureText(text, fontSize, weight).width;
  // The DOM uses tabular figures, while layout measures proportional text.
  const widestDigit = Array.from('0123456789').reduce((widest, digit) =>
    measure(digit) > measure(widest) ? digit : widest,
  );
  const measuredNumbers = new Map<string, number>();
  const measureNumber = (text: string) => {
    const digits = text.replace(/\d/g, widestDigit);
    const previous = measuredNumbers.get(digits);
    if (previous !== undefined) return previous;
    const width = measure(digits) + 1;
    measuredNumbers.set(digits, width);
    return width;
  };
  const requested = mark.columns ?? DEFAULT_COLUMNS;
  const columns = requested.filter(
    (column) => column !== 'bar' || area.width >= 520 || requested.length === 1,
  );
  const hasBar = columns.includes('bar');
  const hasShare = columns.includes('share');
  const hasValue = columns.includes('value');
  const emptyWidth = measure(EMPTY);
  let shareWidth = emptyWidth;
  let valueWidth = emptyWidth;
  if (hasValue || hasShare) {
    for (let period = 0; period < periodCount; period++) {
      const shareBase = hasShare ? periodShareBase(model.matrix.values, period) : undefined;
      for (const series of model.matrix.values) {
        const value = series[period];
        if (!Number.isFinite(value)) continue;
        if (shareBase)
          shareWidth = Math.max(shareWidth, measureNumber(shareText(value, shareBase)));
        if (!hasValue) continue;
        valueWidth = Math.max(valueWidth, measureNumber(model.formatValue(value)));
        const next = series[period + 1];
        if (!Number.isFinite(next) || next === value) continue;
        // Format samples between observations to allow for digits trimmed off the endpoints.
        for (const fraction of VALUE_WIDTH_SAMPLES) {
          const between = interpolateRaceValue(series, period, fraction);
          if (Number.isFinite(between)) {
            valueWidth = Math.max(valueWidth, measureNumber(model.formatValue(between)));
          }
        }
      }
    }
  }

  const maxChange = Math.max(0, top - 1);
  const widths: Record<RaceTableColumn, number> = {
    rank: Math.max(emptyWidth, measureNumber(String(top))),
    change: Math.max(
      emptyWidth,
      measure('new'),
      measureNumber(`↑${maxChange}`),
      measureNumber(`↓${maxChange}`),
    ),
    name: labels.reduce((width, label) => Math.max(width, measure(label)), 0) + CHIP_WIDTH_AND_GAP,
    bar: 0,
    value: valueWidth,
    share: shareWidth,
  };
  const fixed = columns.filter((column) => column !== 'bar');
  for (const column of fixed) {
    widths[column] =
      Math.ceil(Math.max(widths[column], measure(LABELS[column], semibold))) + CELL_PADDING;
  }
  const fixedWidth = fixed.reduce((sum, column) => sum + widths[column], 0);
  if (columns.includes('name')) {
    // Tight tables give the numeric columns their measured widths first.
    const nameBudget = Math.max(0, area.width - (fixedWidth - widths.name));
    widths.name = hasBar ? Math.min(widths.name, nameBudget) : nameBudget;
  }
  const fittedWidth = fixed.reduce((sum, column) => sum + widths[column], 0);
  const shrink = fittedWidth > area.width ? area.width / fittedWidth : 1;
  widths.bar = Math.max(0, area.width - fittedWidth);
  const headerHeight = Math.min(area.height, fontSize + 12);
  let x = area.x;
  return {
    headerHeight,
    rowHeight: (area.height - headerHeight) / top,
    fontSize,
    labels: { ...LABELS },
    columns: columns.map((column) => {
      const width = widths[column] * shrink;
      const position = { column, x, width };
      x += width;
      return position;
    }),
  };
};

function changeCell(rank: number, previous: number, top: number): RaceTableCell {
  if (rank >= top || rank === previous) return { column: 'change', direction: 'same', text: EMPTY };
  if (previous >= top) return { column: 'change', direction: 'new', text: 'new' };
  if (rank < previous) return { column: 'change', direction: 'up', text: `↑${previous - rank}` };
  return { column: 'change', direction: 'down', text: `↓${rank - previous}` };
}

/** Places rows at their smoothed ranks while holding their rank labels at the observed period. */
export const tableGeometry: RaceMarkEntry<'table'>['geometry'] = (
  { timeline, matrix },
  { static: { rowHeight, columns } },
  frame,
) => {
  const { t, items } = frame;
  const period = Math.floor(t);
  const { top } = timeline;
  const keyIndices = new Map(matrix.keys.map((key, index) => [key, index]));
  const shareBase = columns.some(({ column }) => column === 'share')
    ? periodShareBase(matrix.values, period)
    : undefined;
  let min = 0;
  let max = 0;
  for (const { value } of items) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const magnitude = Math.max(-min, max) || 1;
  const span = max / magnitude - min / magnitude || 1;
  const rows = items.map((item) => {
    const keyIndex = keyIndices.get(item.key);
    if (keyIndex === undefined) throw new Error(`Unknown race table key: ${item.key}`);
    const rank = Math.round(timeline.rankPos(keyIndex, period));
    const previous = period > 0 ? Math.round(timeline.rankPos(keyIndex, period - 1)) : rank;
    // Use the local motion around the playhead, independently of the period change label.
    const movesUp = timeline.rankPos(keyIndex, t + 0.001) < timeline.rankPos(keyIndex, t - 0.001);
    const cells = columns.map(({ column, width }): RaceTableCell => {
      switch (column) {
        case 'rank':
          return { column, text: rank < top ? String(rank + 1) : EMPTY };
        case 'change':
          return changeCell(rank, previous, top);
        case 'name':
          return { column, text: item.label, color: item.color };
        case 'bar': {
          const value = item.value / magnitude;
          const x = ((Math.min(0, value) - min / magnitude) / span) * width;
          return { column, x, width: (Math.abs(value) / span) * width, color: item.color };
        }
        case 'share':
          return {
            column,
            text: shareBase ? shareText(matrix.values[keyIndex][period], shareBase) : EMPTY,
          };
      }
      return { column, text: item.valueLabel };
    });
    return {
      row: { key: item.key, y: item.rankPos * rowHeight, opacity: item.opacity, cells },
      movesUp,
    };
  });
  rows.sort((a, b) => Number(a.movesUp) - Number(b.movesUp));
  return { mark: 'table', rows: rows.map(({ row }) => row) };
};
