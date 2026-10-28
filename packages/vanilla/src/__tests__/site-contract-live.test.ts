import { describe, expect, it } from 'vitest';
import { createChart } from '../index';
import { finding, siteSpec, siteSpecs } from './__fixtures__/static-specs';

describe('site island contract (happy-dom; browser reduced-motion coverage belongs to U11)', () => {
  it('[4.2f#15/#25] island theme and keyboard focus can drive host status without a duplicate table [U11]', () => {
    const host = document.createElement('div');
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    document.body.append(host, status);
    const spec = siteSpec({
      ...siteSpecs.countCell,
      display: undefined,
      a11y: { description: finding, table: false },
    });
    const options = {
      darkMode: 'off' as const,
      onMarkFocus: (event: { description?: string }) => {
        status.textContent = event.description ?? '';
      },
    };
    const chart = createChart(host, spec, options);
    try {
      expect(host.querySelector('svg')?.getAttribute('data-theme')).toBe('light');
      expect(host.querySelector('table')).toBeNull();
      const mark = host.matches('[tabindex="0"]')
        ? host
        : host.querySelector<SVGElement>('[tabindex="0"]');
      expect(mark).not.toBeNull();
      mark?.dispatchEvent(new FocusEvent('focus'));
      mark?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(status.textContent).toContain('40 projects');
    } finally {
      chart.destroy();
      host.remove();
      status.remove();
    }
  });
});
