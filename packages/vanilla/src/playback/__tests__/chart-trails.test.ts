import type { ChartSpec, DataRow } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../../__test-fixtures__/dom';
import { createChart } from '../../mount';

const data: DataRow[] = ['Avalon', 'Borea', 'Cydonia'].flatMap((country, index) =>
  [2000, 2001, 2002, 2003].map((year) => ({
    country,
    region: index === 2 ? 'South' : 'North',
    year,
    gdp: (100 + 50 * index) * (year - 1990),
    life: 50 + index * 5 + (year - 2000),
  })),
);

function spec(playback: ChartSpec['playback']): ChartSpec {
  return {
    mark: 'point',
    animation: false,
    data,
    playback,
    encoding: {
      x: { field: 'gdp', type: 'quantitative' },
      y: { field: 'life', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
      key: { field: 'country', type: 'nominal' },
      time: { field: 'year', type: 'temporal' },
    },
  };
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.replaceChildren();
});

function mount(playback: ChartSpec['playback']) {
  const container = createContainer(640, 480);
  const chart = createChart(container, spec(playback), { autoResize: false });
  cleanup.push(() => chart.destroy());
  const controller = chart.playback;
  if (!controller) throw new Error('expected a playback controller');
  return { container, controller };
}

/** Vertex count of each drawn trail line, by key. */
function trailVertices(container: HTMLElement): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const trail of container.querySelectorAll('[data-trail-key]')) {
    const points = trail.querySelector('polyline')?.getAttribute('points')?.trim() ?? '';
    counts[trail.getAttribute('data-trail-key') as string] = points
      ? points.split(/\s+/).length
      : 0;
  }
  return counts;
}

describe('playback trails', () => {
  it('draws the named key a trail that grows with the playhead', () => {
    const { container, controller } = mount({ trails: ['Avalon'] });
    controller.seek(0);
    const opening = trailVertices(container);
    controller.seek(2.5);
    const later = trailVertices(container);
    expect(Object.keys(later)).toEqual(['Avalon']);
    expect(later.Avalon).toBeGreaterThan(opening.Avalon);
    const dots = container.querySelectorAll('[data-trail-key="Avalon"] circle');
    expect(dots).toHaveLength(3);
  });

  it('draws the trail under the marks', () => {
    const { container } = mount({ trails: ['Avalon'] });
    const trail = container.querySelector('[data-trail-key]') as Element;
    const mark = container.querySelector('circle[data-key="Avalon"]') as Element;
    expect(trail.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws no trails without the option', () => {
    const { container } = mount(undefined);
    expect(container.querySelector('[data-trail-key], .oc-playback-trails')).toBeNull();
  });

  it('hides the trail with its series', () => {
    const { container } = mount({ trails: ['Avalon'] });
    container
      .querySelector('[data-legend-label="North"]')
      ?.dispatchEvent(createMouseEvent('click', 10, 10));
    const trail = container.querySelector<SVGElement>('[data-trail-key="Avalon"]');
    expect(trail?.style.display).toBe('none');
  });
});
