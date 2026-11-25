import type { ChartLayout, PointMark, TextMarkLayout } from '@opendata-ai/openchart-core';
import type { ChartPlayback, FrameMark } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { renderChartSVG } from '../../svg-renderer';
import { createChartFrameWriter } from '../chart-frames';
import { createFakePlayback, PERIOD_LABELS } from './fake-playback';

const PERIOD_KEY = 'oc-playback-period';
const LABEL_KEY = 'oc-playback-label|Borea';

function textMark(key: string, text: string, x: number, y: number): TextMarkLayout {
  return {
    type: 'textMark',
    key,
    x,
    y,
    text,
    fill: '#000',
    fontSize: 12,
    textAnchor: 'start',
    data: {},
    aria: { decorative: true },
  };
}

/**
 * The fake playback plus overlays shaped like the engine's: a period label reading the
 * nearest period, and a name label 4px right of Borea's bubble sharing its presence.
 */
function withOverlays(presence: (key: string, t: number) => number = () => 1): ChartPlayback {
  const playback = createFakePlayback({ presence });
  const overlaysAt = (t: number): FrameMark[] => {
    const borea = playback.marksAt(t).find((entry) => entry.key === 'Borea');
    if (!borea || borea.mark.type !== 'point') throw new Error('no Borea point');
    const { cx, cy, r } = borea.mark;
    const period = PERIOD_LABELS[Math.round(Math.max(0, Math.min(2, t)))];
    return [
      { key: PERIOD_KEY, mark: textMark(PERIOD_KEY, period, 300, 200), presence: 1 },
      {
        key: LABEL_KEY,
        mark: textMark(LABEL_KEY, 'Borea', cx + r + 4, cy),
        presence: borea.presence,
      },
    ];
  };
  const base: ChartLayout = {
    ...playback.base,
    marks: [overlaysAt(2)[0].mark, ...playback.base.marks, overlaysAt(2)[1].mark],
  };
  return { ...playback, base, overlaysAt };
}

function setup(playback: ChartPlayback) {
  const container = document.createElement('div');
  document.body.append(container);
  const svg = renderChartSVG(playback.base, container, { animate: false });
  const byKey = (key: string) => svg.querySelector(`[data-key="${key}"]`) as SVGElement;
  return { svg, byKey };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('chart frame writer overlays', () => {
  it('renders the overlay text marks with their keys', () => {
    const { byKey } = setup(withOverlays());
    expect(byKey(PERIOD_KEY).textContent).toBe('2002');
    expect(byKey(LABEL_KEY).textContent).toBe('Borea');
  });

  it('writes the period label text for the period nearest t', () => {
    const playback = withOverlays();
    const { svg, byKey } = setup(playback);
    const writer = createChartFrameWriter(svg, playback);
    writer.draw(0);
    expect(byKey(PERIOD_KEY).textContent).toBe('2000');
    writer.draw(0.6);
    expect(byKey(PERIOD_KEY).textContent).toBe('2001');
    writer.draw(1.4);
    expect(byKey(PERIOD_KEY).textContent).toBe('2001');
  });

  it('moves each name label beside its bubble and fades it with the bubble', () => {
    let fading = true;
    const playback = withOverlays((key) => (key === 'Borea' && fading ? 0.4 : 1));
    const { svg, byKey } = setup(playback);
    const writer = createChartFrameWriter(svg, playback);
    writer.draw(1.5);
    const bubble = playback.marksAt(1.5).find((entry) => entry.key === 'Borea')?.mark as PointMark;
    const label = byKey(LABEL_KEY);
    expect(Number(label.getAttribute('x'))).toBeCloseTo(bubble.cx + bubble.r + 4, 2);
    expect(Number(label.getAttribute('y'))).toBeCloseTo(bubble.cy, 2);
    expect(Number(label.getAttribute('opacity'))).toBeCloseTo(0.4, 5);
    expect(label.textContent).toBe('Borea');
    fading = false;
    writer.draw(2);
    expect(label.getAttribute('opacity')).toBeNull();
  });

  it('writes a text mark’s anchor when it changes', () => {
    const playback = withOverlays();
    const flipped: ChartPlayback = {
      ...playback,
      overlaysAt: (t) =>
        playback
          .overlaysAt(t)
          .map((entry) =>
            entry.mark.type === 'textMark' && t > 1
              ? { ...entry, mark: { ...entry.mark, textAnchor: 'end' } }
              : entry,
          ),
    };
    const { svg, byKey } = setup(flipped);
    const writer = createChartFrameWriter(svg, flipped);
    writer.draw(0);
    expect(byKey(LABEL_KEY).getAttribute('text-anchor')).toBe('start');
    writer.draw(2);
    expect(byKey(LABEL_KEY).getAttribute('text-anchor')).toBe('end');
  });

  it('draws marks alone when the playback has no overlays', () => {
    const playback = createFakePlayback();
    const { svg } = setup(playback);
    expect(() => createChartFrameWriter(svg, playback).draw(1)).not.toThrow();
  });
});
