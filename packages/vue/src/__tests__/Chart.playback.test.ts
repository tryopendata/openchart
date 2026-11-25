import type { ChartSpec } from '@opendata-ai/openchart-core';
import type { PlaybackController } from '@opendata-ai/openchart-vanilla';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Chart } from '../Chart';

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

async function mountChart(spec: ChartSpec) {
  const wrapper = mount(Chart, { props: { spec, autoResize: false } });
  await flushPromises();
  return wrapper;
}

/** The live playback controller read through the exposed instance, as a parent ref would. */
function livePlayback(wrapper: Awaited<ReturnType<typeof mountChart>>): PlaybackController | null {
  const { instance } = wrapper.vm as unknown as {
    instance: { playback: PlaybackController | null };
  };
  return instance.playback;
}

function requirePlayback(wrapper: Awaited<ReturnType<typeof mountChart>>): PlaybackController {
  const controller = livePlayback(wrapper);
  if (!controller) throw new Error('expected a playback controller');
  return controller;
}

describe('Chart playback', () => {
  it('exposes a controller for a time spec, opening on the final period', async () => {
    const wrapper = await mountChart(timeSpec());
    const state = requirePlayback(wrapper).getState();
    expect(state.period).toEqual({ index: 2, value: 2002, label: '2002' });
    expect(state.playing).toBe(false);
    wrapper.unmount();
  });

  it('seek changes the reported period', async () => {
    const wrapper = await mountChart(timeSpec());
    const controller = requirePlayback(wrapper);
    controller.seek(0);
    expect(controller.getState().period.label).toBe('2000');
    wrapper.unmount();
  });

  it('keeps the controller and its listeners when the spec changes to another time spec', async () => {
    const wrapper = await mountChart(timeSpec());
    const before = requirePlayback(wrapper);
    const labels: string[] = [];
    before.on('period', (period) => labels.push(period.label));

    await wrapper.setProps({ spec: timeSpec(2) });
    await flushPromises();

    expect(livePlayback(wrapper)).toBe(before);
    before.seek(1);
    expect(labels).toEqual(['2001']);
    wrapper.unmount();
  });

  it('has no controller for a spec without time, and gains one when time is added', async () => {
    const wrapper = await mountChart(staticSpec());
    expect(livePlayback(wrapper)).toBeNull();

    await wrapper.setProps({ spec: timeSpec() });
    await flushPromises();
    expect(livePlayback(wrapper)).not.toBeNull();
    wrapper.unmount();
  });
});
