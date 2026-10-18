import type { ChartSpec } from '@opendata-ai/openchart-core';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Chart } from '../Chart';

const spec: ChartSpec = {
  mark: 'bar',
  data: [{ name: 'A', value: 10 }],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
};

/** Every chart render rebuilds its screen-reader data table, so each addition is one render. */
function renderCount(records: MutationRecord[]): number {
  let renders = 0;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof HTMLElement && node.classList.contains('oc-sr-only')) renders++;
    }
  }
  return renders;
}

describe('spec and revision updates', () => {
  it('re-renders once when spec and revision change together', async () => {
    const wrapper = mount(Chart, { props: { spec, revision: 1, autoResize: false } });
    await flushPromises();
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(wrapper.element, { childList: true, subtree: true });

    await wrapper.setProps({ spec: { ...spec, data: [{ name: 'B', value: 5 }] }, revision: 2 });
    await flushPromises();

    expect(renderCount([...records, ...observer.takeRecords()])).toBe(1);
    expect(wrapper.element.querySelector('.oc-mark-label')?.textContent).toBe('5');
    observer.disconnect();
    wrapper.unmount();
  });
});
