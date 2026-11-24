import type {
  MeasureTextFn,
  RaceLayout,
  RaceTableCell,
  RaceTableColumn,
  Rect,
} from '@opendata-ai/openchart-core';
import { format } from 'd3-format';
import { interpolateRaceValue } from './interpolate';
import type { RaceMarkEntry } from './marks';
import type { RaceMatrix, RaceModel } from './types';

const DEFAULT_COLUMNS: RaceTableColumn[] = ['rank', 'change', 'name', 'bar', 'value', 'share'];
const LABELS: Record<RaceTableColumn, string> = {
  rank: 'Rank',
  change: 'Change',
  name: 'Name',
  bar: '',
  value: 'Value',
  share: 'Share',
};
const CELL_PADDING = 10;
const CHIP_WIDTH_AND_GAP = 14;
const EMPTY = '—';
const formatShare = format('.1%');
// Quartiles alone can all land on whole numbers and miss the formatter's decimal digits.
const VALUE_WIDTH_SAMPLES = [0.25, 0.5, 0.75, Math.SQRT1_2];

function periodShareBase(values: RaceMatrix['values'], period: number) {
  let total = 0;
  let magnitude = 0;
  for (const series of values) {
    const value = series[period];
    if (!Number.isFinite(value)) continue;
    if (value < 0) return null;
    total += value;
    magnitude = Math.max(magnitude, value);
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

type ShareBase = ReturnType<typeof periodShareBase>;

function shareText(value: number, base: ShareBase): string {
  if (!base || base.total === 0) return EMPTY;
  const share = value / base.scale / base.total;
  return Number.isFinite(share * 100) ? formatShare(share) : EMPTY;
}

interface TableModelData {
  keyIndices: Map<string, number>;
  shareBases: Map<number, ShareBase>;
  valueLabels?: Set<string>;
  shareLabels?: Set<string>;
}

const modelData = new WeakMap<RaceModel, TableModelData>();

function tableData(model: RaceModel): TableModelData {
  const cached = modelData.get(model);
  if (cached) return cached;
  const data: TableModelData = {
    keyIndices: new Map(model.matrix.keys.map((key, index) => [key, index])),
    shareBases: new Map(),
  };
  modelData.set(model, data);
  return data;
}

function shareBaseAt(matrix: RaceMatrix, data: TableModelData, period: number): ShareBase {
  const cached = data.shareBases.get(period);
  if (cached !== undefined) return cached;
  const base = periodShareBase(matrix.values, period);
  data.shareBases.set(period, base);
  return base;
}

function digitPattern(text: string): string {
  return text.replace(/\d/g, '0');
}

function collectValueLabels({ matrix, formatValue }: RaceModel): Set<string> {
  const labels = new Set([EMPTY]);
  for (const series of matrix.values) {
    for (let period = 0; period < series.length; period++) {
      const value = series[period];
      if (!Number.isFinite(value)) continue;
      labels.add(digitPattern(formatValue(value)));
      const next = series[period + 1];
      if (!Number.isFinite(next) || next === value) continue;
      // Allow for digits trimmed off the observed endpoints.
      for (const fraction of VALUE_WIDTH_SAMPLES) {
        const between = interpolateRaceValue(series, period, fraction);
        if (Number.isFinite(between)) labels.add(digitPattern(formatValue(between)));
      }
    }
  }
  return labels;
}

function collectShareLabels(matrix: RaceMatrix, data: TableModelData): Set<string> {
  const labels = new Set([EMPTY]);
  for (let period = 0; period < matrix.periods.length; period++) {
    const base = shareBaseAt(matrix, data, period);
    if (!base || base.total === 0) continue;
    for (const series of matrix.values) {
      labels.add(digitPattern(shareText(series[period], base)));
    }
  }
  return labels;
}

function measureColumns(
  model: RaceModel,
  { labels, theme }: Pick<RaceLayout, 'labels' | 'theme'>,
  columns: RaceTableColumn[],
  measureText: MeasureTextFn,
): Record<RaceTableColumn, number> {
  const { body: fontSize } = theme.fonts.sizes;
  const { normal, semibold } = theme.fonts.weights;
  const { top } = model.timeline;
  const measure = (text: string, weight = normal) => measureText(text, fontSize, weight).width;
  // The DOM uses tabular figures, while layout measures proportional text.
  const widestDigit = Array.from('0123456789').reduce((widest, digit) =>
    measure(digit) > measure(widest) ? digit : widest,
  );
  const measureNumber = (pattern: string) => measure(pattern.replace(/0/g, widestDigit)) + 1;
  const measureNumbers = (patterns: Set<string> | undefined) => {
    let width = 0;
    for (const pattern of patterns ?? []) width = Math.max(width, measureNumber(pattern));
    return width;
  };
  const data = tableData(model);
  const valueLabels = columns.includes('value')
    ? (data.valueLabels ??= collectValueLabels(model))
    : undefined;
  const shareLabels = columns.includes('share')
    ? (data.shareLabels ??= collectShareLabels(model.matrix, data))
    : undefined;

  const emptyWidth = measure(EMPTY);
  const maxChange = digitPattern(String(Math.max(0, top - 1)));
  const widths: Record<RaceTableColumn, number> = {
    rank: Math.max(emptyWidth, measureNumber(digitPattern(String(top)))),
    change: Math.max(
      emptyWidth,
      measure('new'),
      measureNumber(`↑${maxChange}`),
      measureNumber(`↓${maxChange}`),
    ),
    name: labels.reduce((width, label) => Math.max(width, measure(label)), 0) + CHIP_WIDTH_AND_GAP,
    bar: 0,
    value: measureNumbers(valueLabels),
    share: measureNumbers(shareLabels),
  };
  for (const column of columns) {
    if (column === 'bar') continue;
    widths[column] =
      Math.ceil(Math.max(widths[column], measure(LABELS[column], semibold))) + CELL_PADDING;
  }
  return widths;
}

function fitColumns(
  columns: RaceTableColumn[],
  widths: Record<RaceTableColumn, number>,
  area: Rect,
) {
  const fixed = columns.filter((column) => column !== 'bar');
  const fixedWidth = fixed.reduce((sum, column) => sum + widths[column], 0);
  if (columns.includes('name')) {
    // Tight tables give the numeric columns their measured widths first.
    const nameBudget = Math.max(0, area.width - (fixedWidth - widths.name));
    widths.name = columns.includes('bar') ? Math.min(widths.name, nameBudget) : nameBudget;
  }
  const fittedWidth = fixed.reduce((sum, column) => sum + widths[column], 0);
  const shrink = fittedWidth > area.width ? area.width / fittedWidth : 1;
  widths.bar = Math.max(0, area.width - fittedWidth);
  let x = area.x;
  return columns.map((column) => {
    const width = widths[column] * shrink;
    const position = { column, x, width };
    x += width;
    return position;
  });
}

/** Measures `RaceTableMarkDef.columns` and drops `bar` below 520px unless it is the only column. */
export const computeTableStatic: RaceMarkEntry<'table'>['computeStatic'] = (
  model,
  base,
  mark,
  measureText,
) => {
  const { area, theme } = base;
  const fontSize = theme.fonts.sizes.body;
  const headerHeight = Math.min(area.height, fontSize + 12);
  const requested = mark.columns ?? DEFAULT_COLUMNS;
  const columns = requested.filter(
    (column) => column !== 'bar' || area.width >= 520 || requested.length === 1,
  );
  return {
    headerHeight,
    rowHeight: (area.height - headerHeight) / model.timeline.top,
    fontSize,
    labels: { ...LABELS },
    columns: fitColumns(columns, measureColumns(model, base, columns, measureText), area),
  };
};

function changeCell(rank: number, previous: number, top: number): RaceTableCell {
  if (rank === previous) return { column: 'change', direction: 'same', text: '' };
  if (previous >= top) return { column: 'change', direction: 'new', text: 'new' };
  if (rank < previous) return { column: 'change', direction: 'up', text: `↑${previous - rank}` };
  return { column: 'change', direction: 'down', text: `↓${rank - previous}` };
}

/** Slide rows through the table, ranking the visible values at the playhead. */
export const tableGeometry: RaceMarkEntry<'table'>['geometry'] = (
  model,
  { static: { rowHeight, columns } },
  frame,
) => {
  const { timeline, matrix } = model;
  const {
    t,
    items,
    period: { index: period },
    domain: [min, max],
  } = frame;
  const { top } = timeline;
  const data = tableData(model);
  const shareBase = columns.some(({ column }) => column === 'share')
    ? shareBaseAt(matrix, data, period)
    : null;
  const magnitude = Math.max(-min, max) || 1;
  const span = max / magnitude - min / magnitude || 1;
  const lastSlot = top - 1;
  const fold = items.findIndex(({ rankPos }) => rankPos >= lastSlot);
  const edgeIndex = fold === -1 ? lastSlot : Math.min(fold, lastSlot);
  const edge = items[edgeIndex];
  const waiting = items[edgeIndex + 1];
  let edgePosition = edge?.rankPos ?? top;
  if (edge && waiting) {
    // When two rows meet at the fold, only the one closer to it can paint.
    // Ease in that constraint across the inner half slot so a newcomer
    // overtaking into the table keeps its fade as it leaves the fold.
    const blend = Math.max(0, Math.min(1, 1 + 2 * (edge.rankPos - lastSlot)));
    edgePosition += blend * (top - waiting.rankPos);
  }
  const visible = items
    .slice(0, edgeIndex + Number(edgePosition < top))
    .sort((a, b) => a.rank - b.rank);
  const rows = visible.map((item, rank) => {
    const keyIndex = data.keyIndices.get(item.key);
    if (keyIndex === undefined) throw new Error(`Unknown race table key: ${item.key}`);
    const position = item === edge ? edgePosition : item.rankPos;
    // A newcomer may already outrank rows above the fold. Include it in
    // the interior crossing so its cells can move into displayed value order.
    const atEdge = rank === visible.length - 1 && position > lastSlot;
    const y = (atEdge ? position : Math.min(lastSlot, position)) * rowHeight;
    const previous = period > 0 ? timeline.periodRank(keyIndex, period - 1) : rank;
    const motion = timeline.rankPos(keyIndex, t + 0.001) - timeline.rankPos(keyIndex, t - 0.001);
    const settled =
      !atEdge &&
      (t === timeline.periodCount - 1 ||
        (Math.abs(motion) < 1e-6 && Math.abs(item.rankPos - rank) < 1e-6));
    const cells = columns.map(({ column, width }): RaceTableCell => {
      switch (column) {
        case 'rank':
          return { column, text: String(rank + 1) };
        case 'change':
          return changeCell(rank, settled ? previous : rank, top);
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
            text: shareText(matrix.values[keyIndex][period], shareBase),
          };
      }
      return { column, text: item.valueLabel };
    });
    return {
      row: {
        key: item.key,
        rank,
        y,
        opacity: Math.min(1, top - position),
        atEdge,
        cells,
      },
      movesUp: motion < 0,
    };
  });
  rows.sort((a, b) => Number(a.movesUp) - Number(b.movesUp));
  return { mark: 'table', rows: rows.map(({ row }) => row) };
};
