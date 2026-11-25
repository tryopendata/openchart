import type {
  ChartSpec,
  DataRow,
  PointMark,
  Rect,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { compileChartPlayback } from '../chart-playback';
import type { ChartPlayback, FrameMark } from '../chart-types';
import { PERIOD_LABEL_KEY, periodLabelPlacement } from '../overlays';
import { bubbleRows, bubbleSpec, compileOptions } from './chart-fixtures';

const LABEL_KEY = 'oc-playback-label|Cydonia';

function compile(rows: DataRow[] = bubbleRows(), overrides = {}): ChartPlayback {
  return compileChartPlayback(bubbleSpec(rows, overrides), compileOptions);
}

function overlays(playback: ChartPlayback, t: number): FrameMark[] {
  return playback.overlaysAt(t);
}

function text(frame: FrameMark[], key: string): TextMarkLayout | undefined {
  const found = frame.find((entry) => entry.key === key)?.mark;
  return found?.type === 'textMark' ? found : undefined;
}

function point(frame: FrameMark[], key: string): FrameMark & { mark: PointMark } {
  const found = frame.find((entry) => entry.key === key);
  if (!found || found.mark.type !== 'point') throw new Error(`no point for ${key}`);
  return found as FrameMark & { mark: PointMark };
}

describe('period label', () => {
  it('reads the period the playhead has reached, as the controls do', () => {
    const playback = compile();
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)?.text).toBe('2000');
    expect(text(overlays(playback, 0.9), PERIOD_LABEL_KEY)?.text).toBe('2000');
    expect(text(overlays(playback, 1.6), PERIOD_LABEL_KEY)?.text).toBe('2001');
  });

  it('honors playback.period.format', () => {
    const playback = compile(bubbleRows(), { playback: { period: { format: "'%y" } } });
    expect(text(overlays(playback, 1), PERIOD_LABEL_KEY)?.text).toBe("'01");
  });

  it('sits centered behind a scatter plot, large, faint and decorative', () => {
    const playback = compile();
    const area = playback.frame.chartArea;
    const label = text(overlays(playback, 0), PERIOD_LABEL_KEY);
    expect(label).toMatchObject({
      x: area.x + area.width / 2,
      y: area.y + area.height / 2,
      textAnchor: 'middle',
      dominantBaseline: 'central',
      aria: { decorative: true },
    });
    expect(label?.fontSize).toBeGreaterThan(playback.frame.theme.fonts.sizes.title);
    expect(label?.fill).toMatch(/^rgba\(.*, 0\.12\)$/);
  });

  it.each([
    ['none', 'none', false, '0.12'],
    ['a CSS variable', 'var(--page-bg)', false, '0.12'],
    ['transparent', 'transparent', false, '0.12'],
    ['transparent, dark', 'transparent', true, '0.16'],
  ])('is the text color at low alpha on a %s background', (_case, background, dark, alpha) => {
    const playback = compileChartPlayback(
      bubbleSpec(bubbleRows(), { theme: { colors: { background, text: '#102030' } } }),
      { ...compileOptions, darkMode: dark },
    );
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)?.fill).toBe(`rgba(16, 32, 48, ${alpha})`);
  });

  it('mixes the text color into an opaque background', () => {
    const playback = compile(bubbleRows(), {
      theme: { colors: { background: '#ffffff', text: '#000000' } },
    });
    // 12% of the way from white to black.
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)?.fill).toBe('rgb(224, 224, 224)');
  });

  it('leaves a text color it can’t parse to the browser at low alpha', () => {
    const playback = compile(bubbleRows(), {
      theme: { colors: { background: '#ffffff', text: 'var(--ink)' } },
    });
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)?.fill).toBe(
      'color-mix(in srgb, var(--ink) 12%, transparent)',
    );
  });

  it('is left out when only one period has values', () => {
    const playback = compile(bubbleRows().filter((row) => row.year === 2000));
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)).toBeUndefined();
    expect(playback.base.marks.some((mark) => mark.type === 'textMark')).toBe(false);
  });

  it('is left out when playback.period is false', () => {
    const playback = compile(bubbleRows(), { playback: { period: false } });
    expect(text(overlays(playback, 1), PERIOD_LABEL_KEY)).toBeUndefined();
    expect(playback.base.marks.some((mark) => mark.type === 'textMark')).toBe(false);
  });
});

describe('period label auto position for bars', () => {
  const barRows: DataRow[] = ['Male', 'Female'].flatMap((sex) =>
    ['0-4', '5-9'].flatMap((age) =>
      [2000, 2001].map((year, index) => ({ sex, age, year, pop: 50 + index * 10 })),
    ),
  );
  const barSpec = (mark: ChartSpec['mark']): ChartSpec => ({
    mark,
    data: barRows,
    encoding: {
      y: { field: 'age', type: 'ordinal' },
      x: { field: 'pop', type: 'quantitative' },
      color: { field: 'sex', type: 'nominal' },
      time: { field: 'year', type: 'temporal' },
    },
  });

  it('centers the label behind plain bars', () => {
    const playback = compileChartPlayback(barSpec('bar'), compileOptions);
    const area = playback.frame.chartArea;
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)).toMatchObject({
      x: area.x + area.width / 2,
      y: area.y + area.height / 2,
      textAnchor: 'middle',
    });
  });

  it('puts it in the upper right of a mirrored pyramid', () => {
    const playback = compileChartPlayback(barSpec({ type: 'bar', mirror: true }), compileOptions);
    const area = playback.frame.chartArea;
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)).toMatchObject({
      x: area.x + area.width - 8,
      y: area.y + 8,
      textAnchor: 'end',
    });
  });
});

describe('periodLabelPlacement', () => {
  const area: Rect = { x: 40, y: 20, width: 600, height: 400 };

  it.each([
    ['scatter', { x: 340, y: 220, textAnchor: 'middle' }],
    ['map', { x: 48, y: 412, textAnchor: 'start' }],
    ['pyramid', { x: 632, y: 28, textAnchor: 'end' }],
  ] as const)('resolves auto for a %s', (kind, expected) => {
    expect(periodLabelPlacement('auto', area, kind)).toMatchObject(expected);
  });

  it.each([
    ['center', { x: 340, y: 220, textAnchor: 'middle' }],
    ['top-right', { x: 632, y: 28, textAnchor: 'end' }],
    ['bottom-left', { x: 48, y: 412, textAnchor: 'start' }],
  ] as const)('honors an explicit %s whatever the kind', (position, expected) => {
    expect(periodLabelPlacement(position, area, 'map')).toMatchObject(expected);
  });

  it('scales the font with the plot and clamps it', () => {
    const centered = (width: number, height: number) =>
      periodLabelPlacement('center', { x: 0, y: 0, width, height }, 'scatter').fontSize;
    expect(centered(600, 400)).toBe(140);
    expect(centered(300, 400)).toBe(75);
    expect(centered(40, 40)).toBe(28);
    expect(centered(4000, 4000)).toBe(180);
  });
});

describe('name labels', () => {
  it('labels only the playback.labels keys, beside their bubble at every t', () => {
    const playback = compile(bubbleRows(), { playback: { labels: ['Dorne'] } });
    const dorneKey = 'oc-playback-label|Dorne';
    for (const t of [0, 0.5, 2]) {
      const frame = overlays(playback, t);
      const names = frame.filter((entry) => entry.key !== PERIOD_LABEL_KEY);
      expect(names.map((entry) => entry.key)).toEqual([dorneKey]);
      const bubble = point(playback.marksAt(t), 'Dorne').mark;
      expect(text(frame, dorneKey)).toMatchObject({
        text: 'Dorne',
        y: bubble.cy,
        textAnchor: 'start',
        dominantBaseline: 'central',
      });
      expect(text(frame, dorneKey)?.x).toBeGreaterThan(bubble.cx + bubble.r);
    }
  });

  it('sits left of a bubble for the whole run when it would pass the plot’s right edge at any period', () => {
    const playback = compile(bubbleRows(), { playback: { labels: ['Cydonia', 'Dorne'] } });
    const area = playback.frame.chartArea;
    // Cydonia ends near the right edge but starts well clear of it.
    const opening = point(playback.marksAt(0), 'Cydonia').mark;
    expect(opening.cx + opening.r + 100).toBeLessThan(area.x + area.width);
    const closing = point(playback.marksAt(2), 'Cydonia').mark;
    expect(closing.cx + closing.r + 40).toBeGreaterThan(area.x + area.width);
    for (const t of [0, 0.5, 1, 1.5, 2]) {
      const frame = overlays(playback, t);
      const bubble = point(playback.marksAt(t), 'Cydonia').mark;
      expect(text(frame, LABEL_KEY)).toMatchObject({ textAnchor: 'end' });
      expect(text(frame, LABEL_KEY)?.x).toBeLessThan(bubble.cx - bubble.r);
      expect(text(frame, 'oc-playback-label|Dorne')).toMatchObject({ textAnchor: 'start' });
    }
  });

  it('fades with its bubble', () => {
    const rows = bubbleRows().filter((row) => !(row.country === 'Cydonia' && row.year === 2002));
    const playback = compile(rows, { playback: { labels: ['Cydonia'], gaps: 'drop' } });
    for (const t of [0, 1.5, 2]) {
      const bubble = point(playback.marksAt(t), 'Cydonia');
      const label = overlays(playback, t).find((entry) => entry.key === LABEL_KEY);
      expect(label?.presence).toBe(bubble.presence);
    }
  });

  it('leaves the point marks unlabelled', () => {
    const playback = compile(bubbleRows(), { playback: { labels: ['Cydonia'] } });
    expect(point(playback.marksAt(1), 'Cydonia').mark.label).toBeUndefined();
  });
});

describe('static output', () => {
  it('paints the period label first and the name labels last', () => {
    const spec = bubbleSpec(bubbleRows(), { playback: { labels: ['Cydonia', 'Avalon'] } });
    const layout = compileChart(spec, compileOptions);
    const keys = layout.marks.map((mark) => ('key' in mark ? mark.key : undefined));
    expect(keys[0]).toBe(PERIOD_LABEL_KEY);
    expect(keys.slice(-2).sort()).toEqual([
      'oc-playback-label|Avalon',
      'oc-playback-label|Cydonia',
    ]);
    expect(layout.marks.filter((mark) => mark.type === 'point')).toHaveLength(4);
    expect((layout.marks[0] as TextMarkLayout).text).toBe('2002');
  });

  it('orders its marks exactly as the playback base layout does', () => {
    const spec = bubbleSpec(bubbleRows(), { playback: { labels: ['Cydonia', 'Avalon'] } });
    const keyOf = (mark: { key?: unknown }) => mark.key;
    const staticKeys = compileChart(spec, compileOptions).marks.map(keyOf);
    const baseKeys = compileChartPlayback(spec, compileOptions).base.marks.map(keyOf);
    expect(staticKeys).toEqual(baseKeys);
  });

  it('reads the period playbackT names', () => {
    const layout = compileChart(bubbleSpec(), { ...compileOptions, playbackT: 0.3 });
    expect((layout.marks[0] as TextMarkLayout).text).toBe('2000');
  });

  it('carries the overlays in the playback base layout in the same order', () => {
    const playback = compile(bubbleRows(), { playback: { labels: ['Borea'] } });
    const keys = playback.base.marks.map((mark) => ('key' in mark ? mark.key : undefined));
    expect(keys[0]).toBe(PERIOD_LABEL_KEY);
    expect(keys.at(-1)).toBe('oc-playback-label|Borea');
    expect(playback.keys).not.toContain(PERIOD_LABEL_KEY);
  });
});
