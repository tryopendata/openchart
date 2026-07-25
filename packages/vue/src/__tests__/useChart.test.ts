/**
 * Tests for the useChart composable.
 *
 * Uses a thin harness component that attaches the composable's containerRef
 * to a div and exposes the chart/layout refs for assertions.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import type { ChartInstance } from '@opendata-ai/openchart-vanilla';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, type PropType, toRef } from 'vue';
import { useChart } from '../composables/useChart';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10 },
    { date: '2021-01-01', value: 40 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'GDP Growth',
  },
};

const barSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
  chrome: {
    title: 'Updated Title',
  },
};

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const ChartHarness = defineComponent({
  props: {
    spec: {
      type: Object as PropType<ChartSpec>,
      required: true,
    },
  },
  setup(props) {
    const specRef = toRef(props, 'spec');
    const { containerRef, chart, layout } = useChart(specRef);
    return { containerRef, chart, layout };
  },
  render() {
    return h('div', [
      h('div', { ref: 'containerRef', 'data-testid': 'chart-container' }),
      h('span', { 'data-testid': 'has-chart' }, String(this.chart !== null)),
      h('span', { 'data-testid': 'has-layout' }, String(this.layout !== null)),
    ]);
  },
});

async function mountHarness(spec: ChartSpec) {
  const wrapper = mount(ChartHarness, { props: { spec } });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChart', () => {
  it('mounts a chart instance into the container ref', async () => {
    const wrapper = await mountHarness(lineSpec);

    const container = wrapper.find('[data-testid="chart-container"]');
    expect(container.find('svg').exists()).toBe(true);
    expect(wrapper.find('[data-testid="has-chart"]').text()).toBe('true');
    wrapper.unmount();
  });

  it('produces a non-null layout after mounting', async () => {
    const wrapper = await mountHarness(lineSpec);

    expect(wrapper.find('[data-testid="has-layout"]').text()).toBe('true');
    wrapper.unmount();
  });

  it('updates the chart when the spec ref changes', async () => {
    const wrapper = await mountHarness(lineSpec);

    expect(wrapper.find('.oc-title').text()).toBe('GDP Growth');

    await wrapper.setProps({ spec: barSpec });
    await flushPromises();

    expect(wrapper.find('.oc-title').text()).toBe('Updated Title');
    expect(wrapper.find('[data-testid="has-layout"]').text()).toBe('true');
    wrapper.unmount();
  });

  it('destroys the chart instance on unmount', async () => {
    const wrapper = await mountHarness(lineSpec);

    const vm = wrapper.vm as unknown as { chart: ChartInstance | null };
    const instance = vm.chart;
    expect(instance).not.toBeNull();

    const destroySpy = vi.spyOn(instance as ChartInstance, 'destroy');
    wrapper.unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
