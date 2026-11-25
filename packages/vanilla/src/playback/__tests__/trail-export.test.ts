/**
 * Trails in a playback chart's SVG export match the live trails: the same vertices, one
 * dot per observed period, the same style.
 */
import type { ChartSpec, DataRow } from '@opendata-ai/openchart-core';
import { TRAIL_STYLE } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../../__test-fixtures__/dom';
import { createChart } from '../../mount';

const YEARS = [2000, 2001, 2002, 2003];

function rows(): DataRow[] {
  return ['Avalon', 'Borea'].flatMap((country, index) =>
    YEARS.map((year, period) => ({
      country,
      region: index === 0 ? 'North' : 'South',
      year,
      gdp: (100 + 80 * index) * (period + 1) ** 2,
      life: 50 + index * 4 + period * (period % 2 ? 3 : -1),
    })),
  );
}

function trailSpec(trails: NonNullable<ChartSpec['playback']>): ChartSpec {
  return {
    mark: 'point',
    data: rows(),
    encoding: {
      x: { field: 'gdp', type: 'quantitative', scale: { type: 'log' } },
      y: { field: 'life', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
      key: { field: 'country', type: 'nominal' },
      time: { field: 'year', type: 'temporal' },
    },
    playback: { autoplay: false, ...trails },
  };
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  document.body.replaceChildren();
});

function mount(spec: ChartSpec) {
  const container = createContainer(640, 420);
  const chart = createChart(container, spec, { autoResize: false });
  cleanup.push(() => chart.destroy());
  return { chart, container };
}

function vertices(points: string): Array<[number, number]> {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number) as [number, number]);
}

/** The vertices of a straight M/L path. */
function pathVertices(d: string): Array<[number, number]> {
  return [...d.matchAll(/[ML]\s*([-\d.e]+)[ ,]([-\d.e]+)/g)].map(
    (match) => [Number(match[1]), Number(match[2])] as [number, number],
  );
}

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe("a playback chart's exported trails", () => {
  it('follow the live polyline and draw one dot per observed period, styled alike', () => {
    const { chart, container } = mount(trailSpec({ trails: ['Avalon'] }));
    chart.playback?.seek(2.5);
    const live = container.querySelector('[data-trail-key="Avalon"]');
    const livePolyline = live?.querySelector('polyline');
    const liveVertices = vertices(livePolyline?.getAttribute('points') ?? '');
    const liveDots = [...(live?.querySelectorAll('circle') ?? [])];
    // Periods 2000 to 2002 are observed by t = 2.5; the head sits between 2002 and 2003.
    expect(liveVertices).toHaveLength(3 + 1);
    expect(liveDots).toHaveLength(3);

    const exported = parse(chart.export('svg'));
    const path = exported.querySelector('[data-key="oc-playback-trail|Avalon"] path');
    expect(pathVertices(path?.getAttribute('d') ?? '')).toEqual(liveVertices);
    const dots = [...exported.querySelectorAll('[data-key^="oc-playback-trail-dot|Avalon|"]')];
    expect(
      dots.map((dot) => [Number(dot.getAttribute('cx')), Number(dot.getAttribute('cy'))]),
    ).toEqual(
      liveDots.map((dot) => [Number(dot.getAttribute('cx')), Number(dot.getAttribute('cy'))]),
    );

    const color = livePolyline?.getAttribute('stroke');
    expect({
      stroke: path?.getAttribute('stroke'),
      width: path?.getAttribute('stroke-width'),
      opacity: path?.getAttribute('opacity'),
    }).toEqual({
      stroke: color,
      width: livePolyline?.getAttribute('stroke-width'),
      opacity: livePolyline?.getAttribute('opacity'),
    });
    expect(livePolyline?.getAttribute('opacity')).toBe(String(TRAIL_STYLE.opacity));
    for (const dot of dots) {
      expect({
        r: dot.getAttribute('r'),
        fill: dot.getAttribute('fill'),
        fillOpacity: dot.getAttribute('fill-opacity'),
        hidden: dot.getAttribute('aria-hidden'),
      }).toEqual({
        r: liveDots[0].getAttribute('r'),
        fill: color,
        fillOpacity: liveDots[0].parentElement?.getAttribute('fill-opacity'),
        hidden: 'true',
      });
    }
    // Under the bubbles: every trail element precedes the first data point.
    const marks = [...exported.querySelectorAll('[data-key]')].map((el) =>
      el.getAttribute('data-key'),
    );
    const firstBubble = marks.indexOf('Avalon');
    const lastTrail = marks.findLastIndex((key) => key?.startsWith('oc-playback-trail'));
    expect(lastTrail).toBeLessThan(firstBubble);
  });

  it('are absent from the export without playback.trails', () => {
    const { chart } = mount(trailSpec({}));
    const exported = parse(chart.export('svg'));
    expect(exported.querySelectorAll('[data-key^="oc-playback-trail"]')).toHaveLength(0);
  });
});
