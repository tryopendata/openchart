import type { ChartSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Chart from '../Chart.svelte';

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

afterEach(() => cleanup());

describe('mount with revision', () => {
  it('does not issue a redundant update right after mount', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(target, { childList: true, subtree: true });

    const { container } = render(Chart, {
      target,
      props: { spec, revision: 1, autoResize: false },
    });
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The mount render only; a redundant update() would render a second time.
    expect(renderCount([...records, ...observer.takeRecords()])).toBe(1);
    observer.disconnect();
  });
});
