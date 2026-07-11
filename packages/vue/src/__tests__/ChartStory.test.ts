import type { ChartSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { ChartStory } from '../ChartStory';

const baseSpec: ChartSpec = {
  mark: 'line',
  data: [
    { year: '2008', value: 10, country: 'US' },
    { year: '2012', value: 40, country: 'US' },
    { year: '2016', value: 25, country: 'US' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'Base' },
};

const steps = [
  {},
  { spec: { chrome: { title: 'One' } } },
  { spec: { chrome: { subtitle: 'Two' } } },
];
const narrative = [h('p', 'Intro'), h('p', 'Middle'), h('p', 'End')];

describe('ChartStory (Vue)', () => {
  it('renders the chart panel and one block per step', async () => {
    const wrapper = mount(ChartStory, { props: { spec: baseSpec, steps, narrative } });
    await flushPromises();

    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.findAll('[data-oc-story-step]')).toHaveLength(3);

    wrapper.unmount();
  });

  it('drives the story from the controlled step prop', async () => {
    const wrapper = mount(ChartStory, { props: { spec: baseSpec, steps, narrative, step: 0 } });
    await flushPromises();

    await wrapper.setProps({ step: 2 });
    await flushPromises();

    expect(wrapper.find('.oc-title').text()).toBe('One');
    expect(wrapper.find('.oc-subtitle').text()).toBe('Two');

    wrapper.unmount();
  });

  it('exposes goTo through the component instance', async () => {
    const wrapper = mount(ChartStory, { props: { spec: baseSpec, steps, narrative } });
    await flushPromises();

    (wrapper.vm as unknown as { goTo(n: number): void }).goTo(1);
    expect(wrapper.find('.oc-title').text()).toBe('One');

    wrapper.unmount();
  });

  it('tears down the chart on unmount', async () => {
    const wrapper = mount(ChartStory, { props: { spec: baseSpec, steps, narrative } });
    await flushPromises();
    expect(wrapper.find('svg').exists()).toBe(true);

    wrapper.unmount();
    expect(wrapper.find('svg').exists()).toBe(false);
  });
});
