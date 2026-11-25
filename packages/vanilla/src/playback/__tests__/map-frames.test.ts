import type { TextMarkLayout } from '@opendata-ai/openchart-core';
import type { MapFillFrame, MapPlayback, MapPointFrame } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { createMapFrameWriter, NO_DATA_FILL_ATTRIBUTE } from '../map-frames';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag: string, attributes: Record<string, string> = {}, text?: string): SVGElement {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

/** A playback whose frames at each integer `t` come from the given tables. */
function fakePlayback(frames: {
  fills: MapFillFrame[][];
  points?: MapPointFrame[][];
  periods?: string[];
}): MapPlayback<unknown> {
  const at = <T>(table: T[][] | undefined, t: number): T[] => table?.[Math.round(t)] ?? [];
  const periods = frames.periods ?? [];
  return {
    fillsAt: (t: number) => at(frames.fills, t),
    pointsAt: (t: number) => at(frames.points, t),
    overlaysAt: (t: number) =>
      periods.length
        ? [{ key: 'oc-playback-period', text: periods[Math.round(t)] } as TextMarkLayout]
        : [],
  } as unknown as MapPlayback<unknown>;
}

function geoSvg(): SVGSVGElement {
  const svg = el('svg') as SVGSVGElement;
  svg.setAttribute(NO_DATA_FILL_ATTRIBUTE, 'url(#hatch)');
  svg.append(
    el('path', { 'data-key': 'CA', fill: '#eee' }),
    el('path', { 'data-key': 'TX', fill: '#eee' }),
    el('circle', { 'data-point-key': 'LA', 'data-base-r': '10', r: '5', fill: '#000' }),
    el('text', { 'data-key': 'oc-playback-period' }, 'Mar 2020'),
  );
  return svg;
}

describe('createMapFrameWriter', () => {
  it('writes feature fills and bin indexes by data-key, and the hatch for no data', () => {
    const svg = geoSvg();
    const writer = createMapFrameWriter(
      svg,
      fakePlayback({
        fills: [
          [
            { key: 'CA', fill: '#123456', noData: false, binIndex: 2 },
            { key: 'TX', fill: '#cccccc', noData: true },
          ],
        ],
      }),
    );
    writer.draw(0);
    const [ca, tx] = svg.querySelectorAll('path');
    expect(ca.getAttribute('fill')).toBe('#123456');
    expect(ca.getAttribute('data-bin-index')).toBe('2');
    expect(tx.getAttribute('fill')).toBe('url(#hatch)');
    expect(tx.getAttribute('data-nodata')).toBe('true');
    expect(tx.hasAttribute('data-bin-index')).toBe(false);
  });

  it('writes point radius at the current zoom, fill and fade by data-point-key', () => {
    const svg = geoSvg();
    const writer = createMapFrameWriter(
      svg,
      fakePlayback({ fills: [[]], points: [[{ key: 'LA', r: 6, fill: '#f00', presence: 0.5 }]] }),
    );
    writer.draw(0);
    const circle = svg.querySelector('circle') as SVGCircleElement;
    // The camera had halved the radius (base 10, drawn 5), so the new radius is halved too.
    expect(circle.getAttribute('data-base-r')).toBe('6');
    expect(circle.getAttribute('r')).toBe('3');
    expect(circle.getAttribute('fill')).toBe('#f00');
    expect(circle.getAttribute('opacity')).toBe('0.5');
  });

  it('writes the period label text', () => {
    const svg = geoSvg();
    createMapFrameWriter(svg, fakePlayback({ fills: [[], []], periods: ['Jan', 'Feb'] })).draw(1);
    expect(svg.querySelector('text')?.textContent).toBe('Feb');
  });

  it('writes a tile group: rect paint and the code and value labels', () => {
    const svg = el('svg');
    const tile = el('g', { 'data-state': 'NY' });
    tile.append(el('rect', { fill: '#eee' }), el('text', {}, 'NY'), el('text', {}, '1'));
    svg.append(tile);
    const frame: MapFillFrame = {
      key: 'NY',
      fill: '#08306b',
      noData: false,
      fillOpacity: 0.8,
      stroke: '#fff',
      labels: { codeFill: '#ffffff', valueText: '9.5', valueFill: '#fafafa' },
    };
    createMapFrameWriter(svg, fakePlayback({ fills: [[frame]] })).draw(0);
    const [code, value] = tile.querySelectorAll('text');
    expect(tile.querySelector('rect')?.getAttribute('fill')).toBe('#08306b');
    expect(tile.querySelector('rect')?.getAttribute('fill-opacity')).toBe('0.8');
    expect(code.style.getPropertyValue('fill')).toBe('#ffffff');
    expect(value.textContent).toBe('9.5');
  });

  it('leaves the SVG alone after destroy', () => {
    const svg = geoSvg();
    const writer = createMapFrameWriter(
      svg,
      fakePlayback({ fills: [[{ key: 'CA', fill: '#123456', noData: false }]] }),
    );
    writer.destroy();
    writer.draw(0);
    expect(svg.querySelector('path')?.getAttribute('fill')).toBe('#eee');
  });
});
