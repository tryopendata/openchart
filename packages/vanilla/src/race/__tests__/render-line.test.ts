import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RaceSpec } from '@opendata-ai/openchart-core';
import { layoutRace, prepareRace, raceGeometryAt } from '@opendata-ai/openchart-engine';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createRace } from '../../race-mount';
import { SVG_NS } from '../../renderers/svg-dom';
import { createRaceLineRenderer } from '../render-line';

const spec = {
  type: 'race',
  mark: 'line',
  height: 360,
  data: [
    { year: 2000, key: 'A', value: 12 },
    { year: 2001, key: 'A', value: 14 },
    { year: 2003, key: 'A', value: 16 },
    { year: 2004, key: 'A', value: 5 },
    { year: 2005, key: 'A', value: 5 },
    ...[1, 2, 3, 4, 50, 52].map((value, index) => ({
      year: 2000 + index,
      key: 'B',
      value,
    })),
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'key' },
    value: { field: 'value', format: '.1f' },
  },
  race: { top: 1, gaps: 'drop', swap: 0, autoplay: false },
} satisfies RaceSpec;

function setup(mark: RaceSpec['mark'] = 'line', input = spec) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const host = document.createElementNS(SVG_NS, 'g');
  svg.append(host);
  const model = prepareRace({ ...input, mark }, {});
  const layout = layoutRace(model, {
    width: 360,
    height: 360,
    theme: { fonts: { sizes: { axisTick: 14 } } },
  });
  if (layout.mark !== 'line') throw new Error('Expected a line layout');
  const renderer = createRaceLineRenderer(host, layout.static, 'test');
  onTestFinished(() => renderer.destroy());
  function draw(t: number) {
    const geometry = raceGeometryAt(model, layout, t);
    if (geometry.mark !== 'line') throw new Error('Expected line geometry');
    renderer.draw(geometry);
    return geometry;
  }
  return { svg, host, renderer, draw };
}

describe('race line renderer', () => {
  it('connects displaced labels with a thin translucent stroke in the series color', () => {
    const { draw, host } = setup('line', {
      ...spec,
      data: [2000, 2001].flatMap((year) =>
        [100, 99, 98, 97].map((value, key) => ({ year, key: String(key), value })),
      ),
      race: { ...spec.race, top: 4 },
    });
    const geometry = draw(1);
    const leaders = [...host.querySelectorAll('.oc-race-line-leader')];
    expect(leaders.length).toBeGreaterThan(0);
    expect(leaders).toHaveLength(geometry.series.filter(({ endLabel }) => endLabel.leader).length);
    for (const [index, { endLabel, color, opacity }] of geometry.series
      .filter(({ endLabel }) => endLabel.leader)
      .entries()) {
      const leader = leaders[index];
      expect(leader.getAttribute('stroke')).toBe(color);
      expect(leader.getAttribute('stroke-width')).toBe('1');
      expect(Number(leader.getAttribute('y1'))).toBeCloseTo(endLabel.leader?.y ?? NaN, 1);
      expect(Number(leader.getAttribute('y2'))).toBeCloseTo(endLabel.y, 1);
      expect(Number(leader.getAttribute('opacity'))).toBeLessThan(opacity);
    }
  });

  it('lifts the zero label above its grid line to clear the first period label', () => {
    const { host, draw } = setup();
    draw(3.1);
    const zero = [...host.querySelectorAll('text')].find((label) => label.textContent === '0.0');
    const gridY = Number(zero?.previousElementSibling?.getAttribute('y1'));
    expect(gridY - Number(zero?.getAttribute('y'))).toBeCloseTo((14 * 3) / 4, 1);
  });

  it.each([
    'bar',
    'line',
  ] as const)('keeps %s SVG text anchors left-to-right in an RTL host', (mark) => {
    const style = document.createElement('style');
    const css = readFileSync(resolve(__dirname, '../../../../core/src/styles/race.css'), 'utf8');
    // Happy DOM omits layered rules when resolving computed styles.
    style.textContent = css.replace(/^@layer oc\.components\s*\{([\s\S]*)\}\s*$/, '$1');
    document.head.append(style);
    const host = document.createElement('div');
    host.dir = 'rtl';
    host.style.direction = 'rtl';
    document.body.append(host);
    const race = createRace(host, { ...spec, mark }, { autoResize: false });
    onTestFinished(() => {
      race.destroy();
      style.remove();
      host.remove();
    });
    const svg = host.querySelector('svg.oc-race');
    if (!svg) throw new Error('Expected a mounted race SVG');
    expect(getComputedStyle(host).direction).toBe('rtl');
    expect(getComputedStyle(svg).direction).toBe('ltr');
  });

  it('rounds numeric SVG attributes and skips non-finite coordinates on draw', () => {
    const { host, draw, renderer } = setup();
    const geometry = draw(3.1);
    const series = geometry.series.find(({ key }) => key === 'A');
    const tick = geometry.xTicks[0];
    if (!series || !tick) throw new Error('Expected a series and a period tick');
    series.opacity = 0.67891;
    series.endLabel.x = 20.1234;
    series.endLabel.y = 30.9876;
    tick.position = 51.2345;
    tick.opacity = 0.34567;
    renderer.draw(geometry);
    const path = host.querySelector('path[data-key="A"]');
    const label = [...host.querySelectorAll('text')].find((node) =>
      node.textContent?.startsWith('A '),
    );
    const tickLabel = [...host.querySelectorAll('text')].find(
      (node) => node.textContent === tick.label,
    );
    expect(path?.getAttribute('opacity')).toBe('0.68');
    expect(label?.getAttribute('x')).toBe('20.12');
    expect(label?.getAttribute('y')).toBe('30.99');
    expect(tickLabel?.getAttribute('x')).toBe('51.23');
    expect(tickLabel?.parentElement?.getAttribute('opacity')).toBe('0.35');

    series.points.splice(1, 0, { x: NaN, y: 100 });
    series.endLabel.x = Infinity;
    tick.position = -Infinity;
    renderer.draw(geometry);
    expect(label?.getAttribute('x')).toBe('20.12');
    expect(tickLabel?.getAttribute('x')).toBe('51.23');
    expect(path?.getAttribute('d')).toMatch(/^M[^ML]+M/);
  });

  it('draws one unfilled, clipped path per series and restarts the path after a gap', () => {
    const { host, draw } = setup();
    const { series } = draw(3.1);
    const paths = [...host.querySelectorAll('path')];
    expect(paths.map((path) => path.getAttribute('data-key'))).toEqual(
      series.map(({ key }) => key),
    );
    const path = paths[0];
    expect(path.getAttribute('data-key')).toBe('A');
    expect(path.getAttribute('fill')).toBe('none');
    expect(path.getAttribute('stroke')).toBe(series[0].color);
    expect(path.getAttribute('stroke-width')).toBe('2');
    expect(path.getAttribute('stroke-linejoin')).toBe('round');
    const commands = path.getAttribute('d')?.split(/(?=[ML])/);
    expect(commands?.map((command) => command[0])).toEqual(['M', 'L', 'M', 'L']);
    const coordinates = commands?.map((command) => command.slice(1).split(',').map(Number));
    const [before, edge, , after, head] = series[0].points;
    expect(coordinates).toEqual(
      [before, edge, after, head].map((point) => {
        if (!point) throw new Error('Expected a finite point');
        return [Number(point.x.toFixed(2)), Number(point.y.toFixed(2))];
      }),
    );
    const clipId = host.querySelector('clipPath')?.id;
    expect(clipId).toBe('test-race-line-clip');
    expect(path.getAttribute('clip-path')).toBe(`url(#${clipId})`);
  });

  it('reuses the path, head label, and ticks, then removes the departed series', () => {
    const { host, draw } = setup();
    const first = draw(3.1);
    const path = host.querySelector('path[data-key="A"]');
    const label = [...host.querySelectorAll('text')].find((node) =>
      node.textContent?.startsWith('A '),
    );
    const tick = [...host.querySelectorAll('text')].find((node) => node.textContent === '2000');
    expect(label?.textContent).toBe(`A ${first.series[0].endLabel.value}`);
    expect(label?.firstElementChild?.getAttribute('fill')).toBe(first.series[0].color);
    expect(label?.lastElementChild?.getAttribute('class')).toBe('oc-race-line-value');
    expect(label?.lastElementChild?.hasAttribute('fill')).toBe(false);
    expect(tick).toBeDefined();
    const oldPath = path?.getAttribute('d');

    const second = draw(3.2);
    expect(host.querySelector('path[data-key="A"]')).toBe(path);
    expect(path?.getAttribute('d')).not.toBe(oldPath);
    expect([...host.querySelectorAll('text')]).toContain(label);
    expect([...host.querySelectorAll('text')]).toContain(tick);
    const outgoing = second.series.find(({ key }) => key === 'A');
    expect(Number(label?.getAttribute('x'))).toBe(Number(outgoing?.endLabel.x.toFixed(2)));
    expect(Number(label?.getAttribute('y'))).toBe(Number(outgoing?.endLabel.y.toFixed(2)));
    expect(label?.textContent).toBe(`A ${outgoing?.endLabel.value}`);
    expect(Number(path?.getAttribute('opacity'))).toBe(Number(outgoing?.opacity.toFixed(2)));
    const labelOpacity = outgoing?.endLabel.opacity ?? outgoing?.opacity;
    expect(Number(label?.getAttribute('opacity'))).toBe(Number(labelOpacity?.toFixed(2)));

    draw(5);
    expect(host.querySelector('path[data-key="A"]')).toBeNull();
    expect(host.contains(label ?? null)).toBe(false);
    expect(host.querySelectorAll('path')).toHaveLength(1);
    expect(host.querySelector('path[data-key="B"]')).toBeTruthy();
  });

  it('destroy removes only the renderer’s nodes and subsequent draws leave the host alone', () => {
    const { svg, host, renderer, draw } = setup();
    const unrelated = document.createElementNS(SVG_NS, 'circle');
    const sibling = document.createElementNS(SVG_NS, 'title');
    host.prepend(unrelated);
    svg.prepend(sibling);
    const geometry = draw(3.1);
    expect(host.querySelector('path')).toBeTruthy();

    renderer.destroy();
    renderer.draw(geometry);
    renderer.destroy();
    expect([...host.children]).toEqual([unrelated]);
    expect([...svg.children]).toEqual([sibling, host]);
  });

  it('aligns the first and current all-window period labels away from each other', () => {
    const { draw, host } = setup({ type: 'line', window: 'all' });
    const { xTicks } = draw(1);
    const first = [...host.querySelectorAll('text')].find((node) => node.textContent === '2000');
    const current = [...host.querySelectorAll('text')].find((node) => node.textContent === '2001');
    expect(first?.getAttribute('text-anchor')).toBe('end');
    expect(current?.getAttribute('text-anchor')).toBe('start');
    expect(Number(first?.getAttribute('x'))).toBe(Number(xTicks[0].position.toFixed(2)));
    expect(Number(current?.getAttribute('x'))).toBe(Number(xTicks[1].position.toFixed(2)));
  });

  it('keeps playing and renders the fractional head when a bar race updates to line', () => {
    const host = document.createElement('div');
    const race = createRace(host, { ...spec, mark: 'bar' }, { autoResize: false });
    onTestFinished(() => race.destroy());
    race.seek(3.1);
    race.play();
    expect(host.querySelector('.oc-race-rows [data-key="A"]')).toBeTruthy();
    expect(host.querySelector('path[data-key="A"]')).toBeNull();
    race.update(spec);
    expect(race.getState()).toMatchObject({ t: 3.1, period: { label: '2003' }, playing: true });
    const path = host.querySelector('path[data-key="A"]')?.getAttribute('d');
    expect(path?.match(/[ML]/g)).toEqual(['M', 'L', 'M', 'L']);
  });
});
