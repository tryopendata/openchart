import type { RaceBarGeometry, RaceBarRow, RaceBarStatic } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { SVG_NS } from '../../renderers/svg-dom';
import { createRaceBarRenderer } from '../render-bar';

const plot = { x: 90, y: 22.123, width: 220, height: 60 };
const stat: RaceBarStatic = {
  plot,
  clip: { x: 12.345, y: plot.y, width: 350.678, height: plot.height },
  nameX: 80,
  rowHeight: 30,
  barHeight: 22,
  top: 2,
  axisY: 14.456,
  period: { x: 310, y: 65, fontSize: 24 },
  summary: { x: 310, y: 40 },
};

const north: RaceBarRow = {
  key: 'north',
  color: '#123456',
  opacity: 0.924,
  bar: { x: 140, y: 26.456, width: 120.123, height: 22 },
  name: { x: 80, y: 37.456, text: 'North' },
  value: { x: 265.123, y: 37.456, text: '42' },
};

const south: RaceBarRow = {
  key: 'south',
  color: '#654321',
  opacity: 1,
  bar: { x: 100, y: 56, width: 40, height: 22 },
  name: { x: 80, y: 67, text: 'South' },
  value: { x: 95, y: 67, text: '−14' },
};

function setup(idScope = 'example', layout = stat) {
  const host = document.createElementNS(SVG_NS, 'g');
  const renderer = createRaceBarRenderer(host, layout, idScope);
  function draw(overrides: Partial<RaceBarGeometry> = {}) {
    renderer.draw({ mark: 'bar', rows: [], ticks: [], period: null, summary: null, ...overrides });
  }
  return { host, renderer, draw };
}

describe('race bar renderer', () => {
  it('creates one group per key on first draw and updates the same row and marks', () => {
    const { host, draw } = setup();
    expect(host.querySelectorAll('[data-key]')).toHaveLength(0);
    draw({ rows: [north, south] });
    const row = host.querySelector('[data-key="north"]');
    const bar = row?.querySelector('rect');
    const [name, value] = row?.querySelectorAll('text') ?? [];
    expect(host.querySelectorAll('[data-key]')).toHaveLength(2);
    expect(row?.children).toHaveLength(3);
    expect(row?.parentElement).toBe(host.querySelector('.oc-race-rows'));
    expect(row?.getAttribute('opacity')).toBe('0.92');
    expect(['x', 'y', 'width', 'height', 'fill'].map((attr) => bar?.getAttribute(attr))).toEqual([
      '140',
      '26.46',
      '120.12',
      '22',
      '#123456',
    ]);
    expect(name?.textContent).toBe('North');
    expect(name?.getAttribute('text-anchor')).toBe('end');
    expect(name?.getAttribute('x')).toBe('80');
    expect(name?.getAttribute('y')).toBe('37.46');
    expect(value?.textContent).toBe('42');
    expect(value?.getAttribute('x')).toBe('265.12');
    expect(value?.getAttribute('y')).toBe('37.46');
    expect(value?.getAttribute('text-anchor')).toBe('start');
    expect(
      host.querySelector('[data-key="south"] text:last-child')?.getAttribute('text-anchor'),
    ).toBe('end');

    draw({
      rows: [
        south,
        {
          ...north,
          opacity: 0.5,
          bar: { ...north.bar, y: 54, width: 90 },
          name: { ...north.name, y: 65 },
          value: { ...north.value, x: 235, y: 65, text: '31' },
        },
      ],
    });
    expect(host.querySelectorAll('[data-key]')).toHaveLength(2);
    expect(host.querySelector('[data-key="north"]')).toBe(row);
    expect(row?.querySelector('rect')).toBe(bar);
    expect(row?.querySelector('text')).toBe(name);
    expect(row?.querySelector('text:last-child')).toBe(value);
    expect(row?.getAttribute('opacity')).toBe('0.5');
    expect(bar?.getAttribute('y')).toBe('54');
    expect(bar?.getAttribute('width')).toBe('90');
    expect(name?.getAttribute('y')).toBe('65');
    expect(value?.getAttribute('x')).toBe('235');
    expect(value?.getAttribute('y')).toBe('65');
    expect(value?.textContent).toBe('31');
  });

  it('paints crossing bars in geometry order regardless of which key appeared first', () => {
    const played = setup();
    const sought = setup();
    played.draw({ rows: [south] });
    const crossing = [north, { ...south, bar: { ...south.bar, width: 80, y: north.bar.y } }];
    const order = (host: SVGGElement) =>
      [...host.querySelectorAll('.oc-race-rows > [data-key]')].map((row) =>
        row.getAttribute('data-key'),
      );
    played.draw({ rows: crossing });
    sought.draw({ rows: crossing });
    expect(order(played.host)).toEqual(order(sought.host));
    expect(order(played.host)).toEqual(['north', 'south']);
  });

  it('hides absent rows and shows the same nodes when their keys return', () => {
    const { host, draw } = setup();
    draw({ rows: [north, south] });
    const row = host.querySelector('[data-key="north"]');
    draw({ rows: [south] });
    expect(host.querySelector('[data-key="north"]')).toBe(row);
    expect(row?.getAttribute('display')).toBe('none');
    expect(host.querySelector('[data-key="south"]')?.getAttribute('display')).not.toBe('none');
    draw({ rows: [north] });
    expect(host.querySelector('[data-key="north"]')).toBe(row);
    expect(row?.getAttribute('display')).not.toBe('none');
    expect(host.querySelectorAll('[data-key]')).toHaveLength(2);
  });

  it('reuses tick groups by numeric value and removes ticks absent from the next draw', () => {
    const { host, draw } = setup();
    const zero = { value: 0, position: 140, opacity: 1, label: '0' };
    const twenty = { value: 20, position: 200, opacity: 0.456, label: '20' };
    draw({ ticks: [zero, twenty] });
    const axis = host.querySelector('.oc-race-axis');
    const [zeroNode, twentyNode] = axis?.children ?? [];
    const line = twentyNode?.querySelector('line');
    const text = twentyNode?.querySelector('text');
    expect(axis?.children).toHaveLength(2);
    expect(twentyNode?.getAttribute('opacity')).toBe('0.46');
    expect(line?.getAttribute('x1')).toBe('200');
    expect(line?.getAttribute('x2')).toBe('200');
    expect(line?.getAttribute('y1')).toBe('22.12');
    expect(line?.getAttribute('y2')).toBe('82.12');
    expect(text?.getAttribute('y')).toBe('14.46');
    expect(text?.textContent).toBe('20');
    draw({ ticks: [{ ...twenty, position: 185.678, opacity: 0.75, label: '$20' }] });
    expect(axis?.children).toHaveLength(1);
    expect(axis?.contains(zeroNode ?? null)).toBe(false);
    expect(axis?.firstElementChild).toBe(twentyNode);
    expect(twentyNode?.querySelector('line')).toBe(line);
    expect(twentyNode?.querySelector('text')).toBe(text);
    expect(twentyNode?.getAttribute('opacity')).toBe('0.75');
    expect(line?.getAttribute('x1')).toBe('185.68');
    expect(line?.getAttribute('x2')).toBe('185.68');
    expect(text?.getAttribute('x')).toBe('185.68');
    expect(text?.textContent).toBe('$20');
    draw({ ticks: [twenty, zero] });
    expect(axis?.children).toHaveLength(2);
    expect(axis?.firstElementChild).toBe(twentyNode);
    expect(axis?.lastElementChild?.querySelector('text')?.textContent).toBe('0');
  });

  it('scopes the row clip by renderer and includes both label gutters', () => {
    for (const idScope of ['chart-a', 'chart-b']) {
      const { host } = setup(idScope);
      const id = `${idScope}-race-clip`;
      const clip = host.querySelector(`defs clipPath[id="${id}"] rect`);
      expect(['x', 'y', 'width', 'height'].map((attr) => clip?.getAttribute(attr))).toEqual([
        '12.35',
        '22.12',
        '350.68',
        '60',
      ]);
      expect(host.querySelector('.oc-race-rows')?.getAttribute('clip-path')).toBe(`url(#${id})`);
    }
  });

  it('writes period and summary geometry and clears their text when absent', () => {
    const { host, draw } = setup();
    const period = host.querySelector('text.oc-race-period');
    const summary = host.querySelector('text.oc-race-summary');
    draw({
      period: { x: 309.876, y: 65, fontSize: 24.123, text: '1982' },
      summary: { x: 310, y: 40.456, text: '$42 total' },
    });
    expect(period?.textContent).toBe('1982');
    expect(period?.getAttribute('x')).toBe('309.88');
    expect(period?.getAttribute('y')).toBe('65');
    expect(period?.getAttribute('font-size')).toBe('24.12');
    expect(summary?.textContent).toBe('$42 total');
    expect(summary?.getAttribute('x')).toBe('310');
    expect(summary?.getAttribute('y')).toBe('40.46');
    draw();
    expect(host.querySelector('text.oc-race-period')).toBe(period);
    expect(host.querySelector('text.oc-race-summary')).toBe(summary);
    expect(period?.textContent).toBe('');
    expect(summary?.textContent).toBe('');
  });

  it('skips non-finite geometry numbers when writing SVG attributes', () => {
    const { host, draw } = setup('example', {
      ...stat,
      clip: { ...stat.clip, height: NaN },
      axisY: Infinity,
    });
    draw({
      rows: [
        {
          ...north,
          opacity: NaN,
          bar: { ...north.bar, x: NaN, y: Infinity, width: -Infinity },
          name: { ...north.name, y: NaN },
          value: { ...north.value, x: NaN },
        },
      ],
      ticks: [{ value: 0, position: NaN, opacity: Infinity, label: '0' }],
      period: { x: NaN, y: 65, fontSize: Infinity, text: '1980' },
      summary: { x: 310, y: -Infinity, text: '$42 total' },
    });
    expect(host.querySelector('[data-key="north"]')?.getAttribute('opacity')).toBeNull();
    expect(host.querySelector('[data-key="north"] rect')?.getAttribute('x')).toBeNull();
    expect(host.querySelector('.oc-race-period')?.getAttribute('font-size')).toBeNull();
    expect(host.querySelector('clipPath rect')?.getAttribute('height')).toBeNull();
    expect(host.querySelector('.oc-race-axis text')?.getAttribute('y')).toBeNull();
    expect(host.querySelector('[data-key="north"] rect')?.getAttribute('height')).toBe('22');
    expect(host.querySelector('.oc-race-period')?.getAttribute('y')).toBe('65');
    expect(host.outerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('removes every owned node on destroy and preserves existing host children', () => {
    const host = document.createElementNS(SVG_NS, 'g');
    const title = document.createElementNS(SVG_NS, 'title');
    host.append(title);
    const renderer = createRaceBarRenderer(host, stat, 'example');
    renderer.draw({ mark: 'bar', rows: [north], ticks: [], period: null, summary: null });
    renderer.destroy();
    renderer.destroy();
    expect([...host.children]).toEqual([title]);
  });
});
