import type { DataRow, PointMark, Rect, TextMarkLayout } from '@opendata-ai/openchart-core';
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
  if (!playback.overlaysAt) throw new Error('compileChartPlayback must set overlaysAt');
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
  it('reads the period nearest the playhead', () => {
    const playback = compile();
    expect(text(overlays(playback, 0), PERIOD_LABEL_KEY)?.text).toBe('2000');
    expect(text(overlays(playback, 0.4), PERIOD_LABEL_KEY)?.text).toBe('2000');
    expect(text(overlays(playback, 1.6), PERIOD_LABEL_KEY)?.text).toBe('2002');
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

  it('is left out when playback.period is false', () => {
    const playback = compile(bubbleRows(), { playback: { period: false } });
    expect(text(overlays(playback, 1), PERIOD_LABEL_KEY)).toBeUndefined();
    expect(playback.base.marks.some((mark) => mark.type === 'textMark')).toBe(false);
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

  it('flips to the left of a bubble near the plot’s right edge', () => {
    const playback = compile(bubbleRows(), { playback: { labels: ['Cydonia', 'Dorne'] } });
    const area = playback.frame.chartArea;
    const frame = overlays(playback, 2);
    const right = point(playback.marksAt(2), 'Cydonia').mark;
    expect(right.cx + right.r + 40).toBeGreaterThan(area.x + area.width);
    expect(text(frame, LABEL_KEY)).toMatchObject({ textAnchor: 'end' });
    expect(text(frame, LABEL_KEY)?.x).toBeLessThan(right.cx - right.r);
    expect(text(frame, 'oc-playback-label|Dorne')).toMatchObject({ textAnchor: 'start' });
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
