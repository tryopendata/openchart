/**
 * How often a playback chart mount compiles its playback: once per spec, size and font
 * state, never for re-renders that change none of them.
 */
import type { ChartSpec, DataRow } from '@opendata-ai/openchart-core';
import { compileChartPlayback } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

// A pass-through spy: the real compile runs, the test only counts the calls.
vi.mock('@opendata-ai/openchart-engine', async (importOriginal) => {
  const engine = await importOriginal<typeof import('@opendata-ai/openchart-engine')>();
  return { ...engine, compileChartPlayback: vi.fn(engine.compileChartPlayback) };
});
const compiles = vi.mocked(compileChartPlayback);

const data: DataRow[] = ['Avalon', 'Borea', 'Cydonia'].flatMap((country, index) =>
  [2000, 2001, 2002].map((year) => ({
    country,
    region: index === 2 ? 'South' : 'North',
    year,
    gdp: (100 + 50 * index) * (year - 1990),
    life: 50 + index * 5 + (year - 2000),
  })),
);

const spec: ChartSpec = {
  mark: 'point',
  title: 'Wealth and health',
  subtitle: 'Three countries over three years',
  animation: false,
  data,
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'life', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
    key: { field: 'country', type: 'nominal' },
    time: { field: 'year', type: 'temporal' },
  },
};

/** An auto-height host: no height of its own, so it wraps the SVG; the test sets its width. */
function autoHeightHost(initialWidth: number) {
  const container = document.createElement('div');
  let width = initialWidth;
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => {
      const svg = container.querySelector('svg');
      const height = svg ? Number.parseFloat(svg.style.height) || 0 : 0;
      return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 };
    },
  });
  document.body.append(container);
  return {
    container,
    setWidth: (next: number) => {
      width = next;
    },
  };
}

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
  document.body.replaceChildren();
  compiles.mockClear();
});

function mount(host = autoHeightHost(640)) {
  const chart = createChart(host.container, spec, { autoResize: false });
  cleanup.push(() => chart.destroy());
  return { ...host, chart };
}

describe('playback compiles', () => {
  it('compiles nothing for a legend toggle or a re-render at the same size', () => {
    const { container, chart } = mount();
    compiles.mockClear();
    const south = () => container.querySelector('[data-legend-label="South"]');
    south()?.dispatchEvent(createMouseEvent('click', 10, 10));
    south()?.dispatchEvent(createMouseEvent('click', 10, 10));
    chart.resize();
    expect(compiles).not.toHaveBeenCalled();
  });

  it('compiles once per height the auto-height fit tries after a width change', () => {
    const { chart, setWidth } = mount();
    compiles.mockClear();
    setWidth(420);
    chart.resize();
    const heights = compiles.mock.calls.map(([, options]) => options.height);
    expect(heights.length).toBeGreaterThan(0);
    expect(new Set(heights).size).toBe(heights.length);
  });

  it('recompiles once webfonts finish loading', async () => {
    let fontsReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      fontsReady = resolve;
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { check: () => false, ready },
    });
    // A fixed-size host, so only the font state can make the next render compile.
    const host = createContainer(640, 480);
    const { container } = mount({ container: host, setWidth: () => {} });
    expect(container.dataset.ocFontsState).toBe('pending');
    compiles.mockClear();
    fontsReady();
    await ready;
    await Promise.resolve();
    expect(container.dataset.ocFontsState).toBe('ready');
    expect(compiles).toHaveBeenCalled();
  });
});
