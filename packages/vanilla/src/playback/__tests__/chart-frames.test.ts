import { afterEach, describe, expect, it } from 'vitest';
import { renderChartSVG } from '../../svg-renderer';
import { createChartFrameWriter } from '../chart-frames';
import { createFakePlayback, fakeCx, KEYS } from './fake-playback';

function setup(options: Parameters<typeof createFakePlayback>[0] = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const playback = createFakePlayback(options);
  const svg = renderChartSVG(playback.base, container, { animate: false });
  const circle = (key: string) => svg.querySelector(`[data-key="${key}"]`) as SVGElement;
  return { svg, playback, circle };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('chart frame writer', () => {
  it('writes cx, cy and r for each keyed element from marksAt(t)', () => {
    const { svg, playback, circle } = setup();
    const writer = createChartFrameWriter(svg, playback);
    writer.draw(1.5);
    for (const entry of playback.marksAt(1.5)) {
      if (entry.mark.type !== 'point') throw new Error('expected points');
      const el = circle(entry.key);
      expect(Number(el.getAttribute('cx'))).toBeCloseTo(entry.mark.cx, 2);
      expect(Number(el.getAttribute('cy'))).toBeCloseTo(entry.mark.cy, 2);
      expect(Number(el.getAttribute('r'))).toBeCloseTo(entry.mark.r, 2);
    }
    expect(Number(circle('Avalon').getAttribute('cx'))).toBeCloseTo(
      fakeCx(playback.base, 'Avalon', 1.5),
      2,
    );
  });

  it('applies presence as an opacity multiplier and restores full opacity', () => {
    let fading = true;
    const { svg, playback, circle } = setup({
      presence: (key) => (key === 'Borea' && fading ? 0.5 : 1),
    });
    const fillOpacity = circle('Borea').getAttribute('fill-opacity');
    const writer = createChartFrameWriter(svg, playback);
    writer.draw(1);
    expect(Number(circle('Borea').getAttribute('opacity'))).toBeCloseTo(0.5, 5);
    expect(circle('Borea').getAttribute('fill-opacity')).toBe(fillOpacity);
    fading = false;
    writer.draw(2);
    expect(Number(circle('Borea').getAttribute('opacity') ?? 1)).toBe(1);
  });

  it('ignores frame keys with no element', () => {
    const { svg, playback } = setup({ extraKeys: ['Nowhere'] });
    const writer = createChartFrameWriter(svg, playback);
    expect(() => writer.draw(1)).not.toThrow();
    expect(svg.querySelectorAll('[data-key]')).toHaveLength(KEYS.length);
  });

  it('never touches elements without a data-key', () => {
    const { svg, playback } = setup();
    const unkeyed = () =>
      [...svg.querySelectorAll('*')]
        .filter((el) => !el.hasAttribute('data-key'))
        .map((el) => el.cloneNode(false) as Element)
        .map((el) => el.outerHTML);
    const before = unkeyed();
    const writer = createChartFrameWriter(svg, playback);
    writer.draw(0.5);
    writer.draw(2);
    expect(unkeyed()).toEqual(before);
  });

  it('matches by key, not by element order or data-mark-id', () => {
    const { svg, playback, circle } = setup();
    // Reverse the keyed elements in the DOM; frames must still land on the right keys.
    const parent = circle('Avalon').parentNode as Element;
    for (const key of [...KEYS].reverse()) parent.append(circle(key));
    const writer = createChartFrameWriter(svg, playback);
    writer.draw(2);
    for (const key of KEYS) {
      expect(Number(circle(key).getAttribute('cx'))).toBeCloseTo(fakeCx(playback.base, key, 2), 2);
    }
  });

  it('stops writing after destroy', () => {
    const { svg, playback, circle } = setup();
    const writer = createChartFrameWriter(svg, playback);
    writer.draw(1);
    const cx = circle('Avalon').getAttribute('cx');
    writer.destroy();
    writer.draw(2);
    expect(circle('Avalon').getAttribute('cx')).toBe(cx);
  });
});
