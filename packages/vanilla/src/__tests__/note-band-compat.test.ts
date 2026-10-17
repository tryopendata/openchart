import { compileChart } from '@opendata-ai/openchart-engine';
import { expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { footnoteBandHeight } from '../renderers/chrome';
import { renderChartSVG } from '../svg-renderer';

it('normal rendering does not call the deprecated adapter, which warns once when used', () => {
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
    expect(footnoteBandHeight(layout)).toBe(layout.chrome.noteBandHeight);
    expect(footnoteBandHeight(layout)).toBe(layout.chrome.noteBandHeight);
    expect(
      warn.mock.calls.filter(([message]) => String(message).includes('footnoteBandHeight')),
    ).toHaveLength(1);
  } finally {
    warn.mockRestore();
    document.body.innerHTML = '';
  }
});
