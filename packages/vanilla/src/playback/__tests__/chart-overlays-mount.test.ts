/**
 * A mounted playback chart's overlays (the period label and `playback.labels` name labels):
 * how they answer the pointer, how they read in `chart.layout` and exports at the playhead,
 * and how they follow series hiding.
 */
import type {
  ChartLayout,
  ChartSpec,
  DataRow,
  PointMark,
  TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { compileChartPlayback } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../../__test-fixtures__/dom';
import { createChart } from '../../mount';
import { layoutAtPlayhead } from '../frame-layout';

const PERIOD_KEY = 'oc-playback-period';
const AVALON_LABEL = 'oc-playback-label|Avalon';
const CYDONIA_LABEL = 'oc-playback-label|Cydonia';

function rows(): DataRow[] {
  return ['Avalon', 'Borea', 'Cydonia'].flatMap((country, index) =>
    [2000, 2001, 2002].map((year) => ({
      country,
      region: index === 2 ? 'South' : 'North',
      year,
      gdp: (100 + 50 * index) * (year - 1990),
      life: 50 + index * 5 + (year - 2000),
    })),
  );
}

const spec: ChartSpec = {
  mark: 'point',
  animation: false,
  data: rows(),
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'life', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
    key: { field: 'country', type: 'nominal' },
    time: { field: 'year', type: 'temporal' },
  },
  playback: { labels: ['Avalon', 'Cydonia'], autoplay: false },
};

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.replaceChildren();
});

function mount() {
  const container = createContainer(640, 480);
  const chart = createChart(container, spec, { autoResize: false });
  cleanup.push(() => chart.destroy());
  const controller = chart.playback;
  if (!controller) throw new Error('expected a playback controller');
  const byKey = (key: string) => container.querySelector(`[data-key="${key}"]`) as Element;
  return { container, chart, controller, byKey };
}

const tooltipText = (container: HTMLElement) =>
  container.querySelector('.oc-tooltip')?.textContent ?? '';

const dimmed = (container: HTMLElement) =>
  [...container.querySelectorAll('.oc-mark--dim')].map((mark) => mark.getAttribute('data-key'));

function touchStart(target: Element) {
  const event = new Event('touchstart', { bubbles: true });
  Object.defineProperty(event, 'touches', { value: [{ clientX: 100, clientY: 100 }] });
  target.dispatchEvent(event);
}

function layoutText(layout: ChartLayout, key: string): TextMarkLayout | undefined {
  const mark = layout.marks.find((candidate) => candidate.key === key);
  return mark?.type === 'textMark' ? mark : undefined;
}

function layoutPoint(layout: ChartLayout, key: string): PointMark {
  const mark = layout.marks.find((candidate) => candidate.key === key);
  if (mark?.type !== 'point') throw new Error(`no point for ${key}`);
  return mark;
}

describe('pointer on playback overlays', () => {
  it('shows no tooltip for the period label and keeps the emphasis already set', () => {
    const { container, byKey } = mount();
    byKey('Cydonia').dispatchEvent(createMouseEvent('mouseover'));
    const emphasis = dimmed(container);
    expect(emphasis.length).toBeGreaterThan(0);

    byKey(PERIOD_KEY).dispatchEvent(createMouseEvent('mousemove'));
    expect(tooltipText(container)).not.toContain('oc-playback');
    expect(tooltipText(container)).toContain('Cydonia');
    expect(dimmed(container)).toEqual(emphasis);
  });

  it('shows no tooltip when the period label is touched', () => {
    const { container, byKey } = mount();
    touchStart(byKey(PERIOD_KEY));
    expect(tooltipText(container)).toBe('');
    expect(dimmed(container)).toEqual([]);
  });

  it('shows the point’s tooltip and emphasis for its name label', () => {
    const { container, byKey } = mount();
    byKey(AVALON_LABEL).dispatchEvent(createMouseEvent('mouseover'));
    expect(tooltipText(container)).not.toContain('oc-playback');
    expect(tooltipText(container)).toContain('Avalon');
    expect(tooltipText(container)).toContain('2002');
    expect(dimmed(container)).toContain('Cydonia');
    expect(dimmed(container)).not.toContain('Avalon');
  });
});

describe('overlays in the layout at the playhead', () => {
  it('reads the paused period and puts each name label beside its bubble at t', () => {
    const { chart, controller } = mount();
    controller.seek(0.5);
    const layout = chart.layout;
    expect(layoutText(layout, PERIOD_KEY)?.text).toBe('2000');
    const bubble = layoutPoint(layout, 'Avalon');
    const label = layoutText(layout, AVALON_LABEL);
    expect(label?.x).toBeCloseTo(bubble.cx + bubble.r + 4, 6);
    expect(label?.y).toBeCloseTo(bubble.cy, 6);
  });

  it('exports the paused period label and name label positions', () => {
    const { chart, controller } = mount();
    controller.seek(1.5);
    const exported = new DOMParser().parseFromString(String(chart.export('svg')), 'image/svg+xml');
    const exportedKey = (key: string) => exported.querySelector(`[data-key="${key}"]`);
    expect(exportedKey(PERIOD_KEY)?.textContent).toBe('2001');
    const bubble = exportedKey('Avalon');
    const label = exportedKey(AVALON_LABEL);
    const rightEdge = Number(bubble?.getAttribute('cx')) + Number(bubble?.getAttribute('r'));
    expect(Number(label?.getAttribute('x'))).toBeCloseTo(rightEdge + 4, 1);
    expect(label?.getAttribute('y')).toBe(bubble?.getAttribute('cy'));
  });
});

describe('name labels and series hiding', () => {
  const hideSouth = (container: HTMLElement) =>
    container
      .querySelector('[data-legend-label="South"]')
      ?.dispatchEvent(createMouseEvent('click', 10, 10));

  it('hides a hidden series’ name labels on screen and in the layout', () => {
    const { container, chart, controller, byKey } = mount();
    controller.seek(1);
    hideSouth(container);
    expect((byKey(CYDONIA_LABEL) as SVGElement).style.display).toBe('none');
    expect((byKey(AVALON_LABEL) as SVGElement).style.display).toBe('');
    expect(layoutText(chart.layout, CYDONIA_LABEL)).toBeUndefined();
    expect(layoutText(chart.layout, AVALON_LABEL)).toBeDefined();
  });

  it('drops the name label of a hidden point from the layout at the playhead', () => {
    const playback = compileChartPlayback(spec, { width: 640, height: 480, onWarn: () => {} });
    const layout = layoutAtPlayhead(playback, 1, playback.base, new Set(['Cydonia']));
    expect(layoutText(layout, CYDONIA_LABEL)).toBeUndefined();
    expect(layoutText(layout, AVALON_LABEL)).toBeDefined();
  });
});
