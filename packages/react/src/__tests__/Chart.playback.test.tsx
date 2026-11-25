import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Chart, type ChartHandle } from '../Chart';

const YEARS = [2000, 2001, 2002];

function timeSpec(scale = 1): ChartSpec {
  return {
    mark: 'point',
    data: ['Avalon', 'Borea', 'Cydonia'].flatMap((country, index) =>
      YEARS.map((year, period) => ({
        country,
        year,
        gdp: (100 + 50 * index) * (period + 1) * scale,
        life: 50 + index * 5 + period,
      })),
    ),
    encoding: {
      x: { field: 'gdp', type: 'quantitative' },
      y: { field: 'life', type: 'quantitative' },
      key: { field: 'country', type: 'nominal' },
      time: { field: 'year', type: 'temporal' },
    },
    animation: false,
  };
}

function staticSpec(): ChartSpec {
  const { time: _time, ...encoding } = timeSpec().encoding as Record<string, unknown>;
  return { ...timeSpec(), encoding } as ChartSpec;
}

async function renderChart(spec: ChartSpec) {
  const handle = createRef<ChartHandle>();
  const result = render(<Chart ref={handle} spec={spec} autoResize={false} />);
  await waitFor(() => expect(result.container.querySelector('svg')).not.toBeNull());
  return { handle, ...result };
}

function playbackOf(handle: React.RefObject<ChartHandle | null>) {
  const controller = handle.current?.instance?.playback;
  if (!controller) throw new Error('expected a playback controller');
  return controller;
}

afterEach(() => {
  cleanup();
});

describe('<Chart /> playback', () => {
  it('exposes a controller for a time spec, opening on the final period', async () => {
    const { handle } = await renderChart(timeSpec());
    const state = playbackOf(handle).getState();
    expect(state.period).toEqual({ index: 2, value: 2002, label: '2002' });
    expect(state.playing).toBe(false);
  });

  it('seek changes the reported period', async () => {
    const { handle } = await renderChart(timeSpec());
    const controller = playbackOf(handle);
    controller.seek(0);
    expect(controller.getState().period.label).toBe('2000');
  });

  it('keeps the controller and its listeners when the spec changes to another time spec', async () => {
    const { handle, rerender } = await renderChart(timeSpec());
    const before = playbackOf(handle);
    const labels: string[] = [];
    before.on('period', (period) => labels.push(period.label));

    rerender(<Chart ref={handle} spec={timeSpec(2)} autoResize={false} />);

    await waitFor(() => expect(handle.current?.instance?.playback).toBe(before));
    before.seek(1);
    expect(labels).toEqual(['2001']);
  });

  it('has no controller for a spec without time, and gains one when time is added', async () => {
    const { handle, rerender } = await renderChart(staticSpec());
    expect(handle.current?.instance?.playback).toBeNull();

    rerender(<Chart ref={handle} spec={timeSpec()} autoResize={false} />);
    await waitFor(() => expect(handle.current?.instance?.playback).not.toBeNull());
  });
});
