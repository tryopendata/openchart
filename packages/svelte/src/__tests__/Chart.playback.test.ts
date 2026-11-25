import type { ChartSpec } from '@opendata-ai/openchart-core';
import type { PlaybackController } from '@opendata-ai/openchart-vanilla';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Chart from '../Chart.svelte';

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
  const result = render(Chart, { props: { spec, autoResize: false } });
  await waitFor(() => expect(result.container.querySelector('svg')).not.toBeNull());
  return result;
}

/** The live playback controller read through getInstance(), as a bound component would. */
function livePlayback(component: unknown): PlaybackController | null {
  const { getInstance } = component as {
    getInstance(): { playback: PlaybackController | null } | null;
  };
  return getInstance()?.playback ?? null;
}

function requirePlayback(component: unknown): PlaybackController {
  const controller = livePlayback(component);
  if (!controller) throw new Error('expected a playback controller');
  return controller;
}

afterEach(() => {
  cleanup();
});

describe('<Chart /> playback', () => {
  it('exposes a controller for a time spec, opening on the final period', async () => {
    const { component } = await renderChart(timeSpec());
    const state = requirePlayback(component).getState();
    expect(state.period).toEqual({ index: 2, value: 2002, label: '2002' });
    expect(state.playing).toBe(false);
  });

  it('seek changes the reported period', async () => {
    const { component } = await renderChart(timeSpec());
    const controller = requirePlayback(component);
    controller.seek(0);
    expect(controller.getState().period.label).toBe('2000');
  });

  it('keeps the controller and its listeners when the spec changes to another time spec', async () => {
    const { component, rerender } = await renderChart(timeSpec());
    const before = requirePlayback(component);
    const labels: string[] = [];
    before.on('period', (period) => labels.push(period.label));

    await rerender({ spec: timeSpec(2) });

    await waitFor(() => expect(livePlayback(component)).toBe(before));
    before.seek(1);
    expect(labels).toEqual(['2001']);
  });

  it('has no controller for a spec without time, and gains one when time is added', async () => {
    const { component, rerender } = await renderChart(staticSpec());
    expect(livePlayback(component)).toBeNull();

    await rerender({ spec: timeSpec() });
    await waitFor(() => expect(livePlayback(component)).not.toBeNull());
  });
});
