import { compileChart } from '@opendata-ai/openchart-engine';
import { expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import * as chromeRenderer from '../renderers/chrome';
import { renderChartSVG } from '../svg-renderer';

it('renders resolved notes without the removed footnoteBandHeight adapter', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const layout = compileChart(
      {
        mark: 'point',
        data: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
        responsive: { compactAnnotationLimit: 0 },
        annotations: [{ type: 'text', id: 'a', x: 5, y: 5, text: 'A note' }],
      },
      { width: 390, height: 400 },
    );
    renderChartSVG(layout, createContainer());
    expect(
      warn.mock.calls.some(([message]) => String(message).includes('footnoteBandHeight')),
    ).toBe(false);
    expect(chromeRenderer).not.toHaveProperty('footnoteBandHeight');
    expect(layout.chrome.noteBandHeight).toBeGreaterThan(0);
    expect(document.querySelector('.oc-footnotes')?.textContent).toContain('A note');
  } finally {
    warn.mockRestore();
    document.body.innerHTML = '';
  }
});
