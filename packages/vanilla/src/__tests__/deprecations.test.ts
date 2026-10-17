import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
describe('8.x compatibility warnings', () => {
  it('warns once across mounts and keeps autoResize separate from responsive spec', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 2; i++) {
      const chart = createChart(createContainer(), barSpec, {
        responsive: false,
        autoResize: false,
        onDataPointClick: () => {},
        onAnnotationEdit: () => {},
        onTextEdit: () => {},
      });
      chart.destroy();
    }
    for (const name of ['onDataPointClick', 'onAnnotationEdit', 'onTextEdit', 'mount responsive']) {
      expect(warn.mock.calls.filter(([message]) => String(message).includes(name))).toHaveLength(1);
    }
  });
});
