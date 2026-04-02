import type { GradientDef } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { buildGradientDefs, resolveMarkFill } from '../gradient-utils';

const SVG_NS = 'http://www.w3.org/2000/svg';

function createDefs(): SVGElement {
  return document.createElementNS(SVG_NS, 'defs') as SVGElement;
}

const linearGrad: GradientDef = {
  gradient: 'linear',
  stops: [
    { offset: 0, color: '#f00' },
    { offset: 1, color: '#00f' },
  ],
};

const radialGrad: GradientDef = {
  gradient: 'radial',
  stops: [
    { offset: 0, color: '#fff' },
    { offset: 1, color: '#000' },
  ],
};

describe('buildGradientDefs', () => {
  it('creates a linearGradient element for a linear gradient fill', () => {
    const defs = createDefs();
    buildGradientDefs([{ fill: linearGrad }], defs);
    const el = defs.querySelector('linearGradient');
    expect(el).not.toBeNull();
  });

  it('creates a radialGradient element for a radial gradient fill', () => {
    const defs = createDefs();
    buildGradientDefs([{ fill: radialGrad }], defs);
    const el = defs.querySelector('radialGradient');
    expect(el).not.toBeNull();
  });

  it('deduplicates identical gradients', () => {
    const defs = createDefs();
    buildGradientDefs([{ fill: linearGrad }, { fill: linearGrad }], defs);
    const els = defs.querySelectorAll('linearGradient');
    expect(els.length).toBe(1);
  });

  it('creates separate gradient elements for different gradients', () => {
    const defs = createDefs();
    buildGradientDefs([{ fill: linearGrad }, { fill: radialGrad }], defs);
    expect(defs.querySelector('linearGradient')).not.toBeNull();
    expect(defs.querySelector('radialGradient')).not.toBeNull();
    expect(defs.children.length).toBe(2);
  });

  it('skips marks with string fills', () => {
    const defs = createDefs();
    buildGradientDefs([{ fill: '#ff0000' }, { fill: 'steelblue' }], defs);
    expect(defs.children.length).toBe(0);
  });

  it('handles empty marks array', () => {
    const defs = createDefs();
    const map = buildGradientDefs([], defs);
    expect(map.size).toBe(0);
    expect(defs.children.length).toBe(0);
  });

  it('sets correct default attributes on linearGradient', () => {
    const defs = createDefs();
    buildGradientDefs([{ fill: linearGrad }], defs);
    const el = defs.querySelector('linearGradient')!;
    expect(el.getAttribute('x1')).toBe('0');
    expect(el.getAttribute('y1')).toBe('0');
    expect(el.getAttribute('x2')).toBe('0');
    expect(el.getAttribute('y2')).toBe('1');
  });

  it('sets correct stop attributes', () => {
    const grad: GradientDef = {
      gradient: 'linear',
      stops: [
        { offset: 0, color: '#f00', opacity: 0.5 },
        { offset: 1, color: '#00f' },
      ],
    };
    const defs = createDefs();
    buildGradientDefs([{ fill: grad }], defs);
    const stops = defs.querySelectorAll('stop');
    expect(stops.length).toBe(2);
    expect(stops[0].getAttribute('offset')).toBe('0');
    expect(stops[0].getAttribute('stop-color')).toBe('#f00');
    expect(stops[0].getAttribute('stop-opacity')).toBe('0.5');
    expect(stops[1].getAttribute('offset')).toBe('1');
    expect(stops[1].getAttribute('stop-color')).toBe('#00f');
    expect(stops[1].hasAttribute('stop-opacity')).toBe(false);
  });

  it('sets gradientUnits="objectBoundingBox"', () => {
    const defs = createDefs();
    buildGradientDefs([{ fill: linearGrad }], defs);
    const el = defs.querySelector('linearGradient')!;
    expect(el.getAttribute('gradientUnits')).toBe('objectBoundingBox');
  });
});

describe('resolveMarkFill', () => {
  it('returns the string directly for string fills', () => {
    const map = new Map<string, string>();
    expect(resolveMarkFill('#ff0000', map)).toBe('#ff0000');
  });

  it('returns url(#id) for gradient fills that are in the map', () => {
    const defs = createDefs();
    const map = buildGradientDefs([{ fill: linearGrad }], defs);
    const result = resolveMarkFill(linearGrad, map);
    expect(result).toMatch(/^url\(#oc-grad-\d+\)$/);
  });

  it('returns #000000 for gradient fills not in the map', () => {
    const map = new Map<string, string>();
    expect(resolveMarkFill(linearGrad, map)).toBe('#000000');
  });
});
