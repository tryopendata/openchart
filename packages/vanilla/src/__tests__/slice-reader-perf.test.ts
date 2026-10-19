import type { ChartSpec } from '@opendata-ai/openchart-core';
import { expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { createReader } from '../reader';

it('coalesces 1,000-observation inspection without compiling or measuring per pointer frame', () => {
  const spec: ChartSpec = {
    mark: 'line',
    animation: false,
    data: Array.from({ length: 1000 }, (_, index) => ({
      id: index,
      x: index % 200,
      y: index % 71,
      series: `Series ${Math.floor(index / 200)}`,
    })),
    encoding: {
      key: { field: 'id', type: 'nominal' },
      x: { field: 'x', type: 'ordinal' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  };
  const root = createContainer(1000, 500);
  const chart = createChart(root, spec, { autoResize: false });
  const reader = createReader(root, chart, spec, () => {}, { mode: 'slices' });
  const svg = root.querySelector('svg')!;
  const reads = vi.spyOn(svg, 'getBoundingClientRect');
  const generation = root.dataset.ocRenderGen;
  let frame: FrameRequestCallback | undefined;
  let calls = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return ++calls;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frame = undefined;
  });
  const times: number[] = [];
  try {
    for (let index = 0; index < 200; index++) {
      const start = performance.now();
      for (let burst = 0; burst < 3; burst++)
        root.dispatchEvent(
          new MouseEvent('pointermove', {
            clientX:
              chart.layout.area.x + (chart.layout.area.width * ((index + burst) % 200)) / 199,
            clientY: chart.layout.area.y + 20,
            bubbles: true,
          }),
        );
      const callback = frame;
      frame = undefined;
      callback?.(performance.now());
      times.push(performance.now() - start);
    }
    expect(calls).toBe(200);
    expect(reads).not.toHaveBeenCalled();
    expect(root.dataset.ocRenderGen).toBe(generation);
    expect(reader.selection.preview).not.toBeNull();
    times.sort((a, b) => a - b);
    console.info(
      `Reader 1000 observations / 200 frames: p95 ${times[Math.floor(times.length * 0.95)].toFixed(3)}ms, max ${times.at(-1)!.toFixed(3)}ms (DOM simulation; 3 pointer events coalesced per frame).`,
    );
  } finally {
    reader.destroy();
    chart.destroy();
    root.remove();
    reads.mockRestore();
    vi.unstubAllGlobals();
  }
});
