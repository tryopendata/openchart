/**
 * Playback trails on a phone-width Gapminder chart: at the final period each trail runs
 * through every observed year and ends at its bubble, across resizes and updates.
 */
import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { wealthHealthHistory } from '../../../../examples/src/data/wealth-health-history';
import { createChart } from '../mount';

const TRAIL_KEYS = ['China', 'India'];
const PHONE_WIDTH = 360;
const DESKTOP_WIDTH = 640;
const HEIGHT = 480;

const spec: ChartSpec = {
  mark: 'point',
  data: wealthHealthHistory.data,
  encoding: {
    x: { field: 'gdp', type: 'quantitative', scale: { type: 'log' } },
    y: { field: 'life', type: 'quantitative' },
    size: { field: 'pop', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
    key: { field: 'country', type: 'nominal' },
    time: { field: 'year', type: 'temporal' },
  },
  playback: { duration: 20000, labels: ['China', 'India', 'United States'], trails: TRAIL_KEYS },
  chrome: { title: 'China and India got healthier long before they got rich' },
};

const lastPeriod = new Set(wealthHealthHistory.data.map((row) => row.year)).size - 1;

/** Years where the key has both an x and a y value: the trail's observed points. */
function observedYears(key: string): number {
  return wealthHealthHistory.data.filter(
    (row) => row.country === key && row.gdp != null && row.life != null,
  ).length;
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  document.body.replaceChildren();
});

/** A container whose measured width the test can change, as a phone rotation or docs layout would. */
function resizableContainer(initialWidth: number) {
  const container = document.createElement('div');
  let width = initialWidth;
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ width, height: HEIGHT, top: 0, left: 0, right: width, bottom: HEIGHT }),
  });
  document.body.append(container);
  return {
    container,
    setWidth(next: number) {
      width = next;
    },
  };
}

function mount(width: number) {
  const host = resizableContainer(width);
  const chart = createChart(host.container, spec, { autoResize: false });
  cleanup.push(() => chart.destroy());
  return { ...host, chart };
}

/** Each trail's vertex count and last vertex, next to its bubble's centre. */
function drawnTrails(container: HTMLElement) {
  return TRAIL_KEYS.map((key) => {
    const vertices =
      container
        .querySelector(`[data-trail-key="${key}"] polyline`)
        ?.getAttribute('points')
        ?.split(' ') ?? [];
    const bubble = container.querySelector(`[data-key="${key}"]`);
    return {
      key,
      vertices: vertices.length,
      end: vertices.at(-1),
      bubble: `${bubble?.getAttribute('cx')},${bubble?.getAttribute('cy')}`,
    };
  });
}

/** Every observed year plus the head, ending on the bubble. */
function completeTrails(container: HTMLElement) {
  return drawnTrails(container).map(({ key, bubble }) => ({
    key,
    vertices: observedYears(key) + 1,
    end: bubble,
    bubble,
  }));
}

describe('playback trails at phone width', () => {
  it('reach the bubble with every observed year at the final period', () => {
    const { container, chart } = mount(PHONE_WIDTH);
    chart.playback?.seek(lastPeriod);
    expect(drawnTrails(container)).toEqual(completeTrails(container));
    expect(container.querySelectorAll('.oc-playback-trails')).toHaveLength(1);
  });

  it('stay whole after a resize to phone width and an update mid-run', () => {
    const { container, chart, setWidth } = mount(DESKTOP_WIDTH);
    chart.playback?.seek(lastPeriod);
    setWidth(PHONE_WIDTH);
    chart.resize();
    expect(drawnTrails(container)).toEqual(completeTrails(container));

    chart.playback?.seek(40);
    chart.update({ ...spec });
    chart.playback?.seek(lastPeriod);
    expect(drawnTrails(container)).toEqual(completeTrails(container));
    expect(container.querySelectorAll('.oc-playback-trails')).toHaveLength(1);
  });
});
